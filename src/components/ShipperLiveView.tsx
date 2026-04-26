import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, useMap } from 'react-leaflet';
import DynamicTileLayer from '@/components/map/DynamicTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertTriangle, MessageCircle, XCircle, Satellite,
  Search, Filter, Package, ChevronUp, ChevronDown, MapPin,
} from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { motion, useMotionValue, animate } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import LoadChat from '@/components/LoadChat';
import StatusMilestones from '@/components/StatusMilestones';
import { BidList } from '@/components/BidSystem';
import LiveTrackingMap from '@/components/LiveTrackingMap';
import ShipmentCard from '@/components/shared/ShipmentCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Leaflet defaults
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pickupIcon = new L.DivIcon({
  html: `<div style="background:#FBBF24;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 6px 18px rgba(251,191,36,0.45),0 2px 6px rgba(0,0,0,0.15);"><span style="width:6px;height:6px;background:#2D3436;border-radius:50%"></span></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  className: '',
});
const deliveryIcon = new L.DivIcon({
  html: `<div style="background:#2D3436;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.25);"><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  className: '',
});

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const geoCache = new Map<string, { lat: number; lng: number }>();
async function geocode(location: string): Promise<{ lat: number; lng: number } | null> {
  if (geoCache.has(location)) return geoCache.get(location)!;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location + ', Zimbabwe')}&format=json&limit=1`);
    const data = await res.json();
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geoCache.set(location, result);
      return result;
    }
    return null;
  } catch { return null; }
}

const STATUS_PILL: Record<string, string> = {
  posted: 'bg-secondary text-foreground',
  accepted: 'bg-primary/15 text-amber-700 dark:text-amber-300',
  in_transit: 'bg-foreground text-background',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};
const STATUS_LABEL: Record<string, string> = {
  posted: 'Process',
  accepted: 'Accepted',
  in_transit: 'Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

interface GeoShipment {
  load: any;
  pickup?: { lat: number; lng: number };
  delivery?: { lat: number; lng: number };
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11, { animate: true });
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 11 });
    }
  }, [points, map]);
  return null;
}

const SNAP_COLLAPSED = 132;
const SNAP_HALF = 0.5;
const SNAP_FULL = 0.78;

const STATUS_FILTERS = ['posted', 'accepted', 'in_transit'] as const;

export default function ShipperLiveView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedLoad, setSelectedLoad] = useState<any | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [geoShipments, setGeoShipments] = useState<GeoShipment[]>([]);
  const [showLiveMap, setShowLiveMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([...STATUS_FILTERS]);
  const [mismatchPending, setMismatchPending] = useState<{ bidId: string; driverId: string; amount: number; loadId: string } | null>(null);
  const [mismatchInfo, setMismatchInfo] = useState<{ driverTruck: string; requiredTruck: string; plate: string } | null>(null);

  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const snaps = useMemo(() => ({
    collapsed: SNAP_COLLAPSED,
    half: Math.round(vh * SNAP_HALF),
    full: Math.round(vh * SNAP_FULL),
  }), [vh]);

  const sheetHeight = useMotionValue(snaps.half);
  const [snapState, setSnapState] = useState<'collapsed' | 'half' | 'full'>('half');

  useEffect(() => {
    animate(sheetHeight, snaps[snapState], { type: 'spring', damping: 30, stiffness: 280 });
  }, [snaps, snapState, sheetHeight]);

  const snapTo = (state: 'collapsed' | 'half' | 'full') => {
    setSnapState(state);
    animate(sheetHeight, snaps[state], { type: 'spring', damping: 30, stiffness: 280 });
  };

  const cycleSheet = () => {
    if (snapState === 'collapsed') snapTo('half');
    else if (snapState === 'half') snapTo('full');
    else snapTo('collapsed');
  };

  const { data: loads, isLoading } = useQuery({
    queryKey: ['shipper-live-loads', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loads')
        .select('*')
        .eq('shipper_id', user!.id)
        .in('status', ['posted', 'accepted', 'in_transit'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('shipper-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loads' }, () => {
        queryClient.invalidateQueries({ queryKey: ['shipper-live-loads'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Geocode
  useEffect(() => {
    if (!loads?.length) { setGeoShipments([]); return; }
    const geo = async () => {
      const results: GeoShipment[] = [];
      for (let i = 0; i < loads.length; i += 3) {
        const batch = loads.slice(i, i + 3);
        const geos = await Promise.all(batch.map(async (load: any) => {
          const [pickup, delivery] = await Promise.all([
            geocode(load.pickup_location),
            geocode(load.delivery_location),
          ]);
          return { load, pickup: pickup || undefined, delivery: delivery || undefined } as GeoShipment;
        }));
        results.push(...geos);
        if (i + 3 < loads.length) await new Promise(r => setTimeout(r, 1100));
      }
      setGeoShipments(results);
    };
    geo();
  }, [loads]);

  const acceptBid = useMutation({
    mutationFn: async ({ bidId, driverId, amount, loadId }: { bidId: string; driverId: string; amount: number; loadId: string }) => {
      const { error: bidError } = await supabase.from('bids').update({ status: 'accepted' }).eq('id', bidId);
      if (bidError) throw bidError;
      await supabase.from('bids').update({ status: 'rejected' }).eq('load_id', loadId).neq('id', bidId).eq('status', 'pending');
      const platformFee = amount * 0.1;
      const { error: loadError } = await supabase.from('loads').update({
        driver_id: driverId, status: 'accepted', price: amount, platform_fee: platformFee,
        accepted_at: new Date().toISOString(),
      }).eq('id', loadId);
      if (loadError) throw loadError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipper-live-loads'] });
      toast.success('Bid accepted!');
      setMismatchPending(null);
      setMismatchInfo(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleAcceptBidWithCheck = useCallback(async (bidId: string, driverId: string, amount: number, loadId: string) => {
    const load = loads?.find((l: any) => l.id === loadId) || selectedLoad;
    const { data: truckVer } = await supabase
      .from('truck_verifications')
      .select('truck_label, registration_number')
      .eq('user_id', driverId)
      .limit(1)
      .maybeSingle();

    const requiredEquipment = load?.equipment_type;
    const driverTruck = truckVer?.truck_label;
    const hasMismatch = requiredEquipment && driverTruck &&
      !driverTruck.toLowerCase().includes(requiredEquipment.toLowerCase()) &&
      !requiredEquipment.toLowerCase().includes(driverTruck.toLowerCase());

    if (hasMismatch) {
      setMismatchPending({ bidId, driverId, amount, loadId });
      setMismatchInfo({ driverTruck, requiredTruck: requiredEquipment, plate: truckVer?.registration_number || 'N/A' });
    } else {
      acceptBid.mutate({ bidId, driverId, amount, loadId });
    }
  }, [loads, selectedLoad, acceptBid]);

  const filteredLoads = useMemo(() => {
    if (!loads) return [];
    return loads
      .filter((l: any) => {
        if (!statusFilter.includes(l.status)) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const match =
            l.pickup_location?.toLowerCase().includes(q) ||
            l.delivery_location?.toLowerCase().includes(q) ||
            l.title?.toLowerCase().includes(q) ||
            l.tracking_code?.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .map((l: any) => {
        const gs = geoShipments.find((g) => g.load.id === l.id);
        const distKm = gs?.pickup && gs?.delivery
          ? haversineKm(gs.pickup.lat, gs.pickup.lng, gs.delivery.lat, gs.delivery.lng)
          : null;
        const etaMinutes = distKm != null ? Math.round((distKm / 50) * 60) : null;
        return { ...l, distKm, etaMinutes };
      });
  }, [loads, searchQuery, statusFilter, geoShipments]);

  const featuredLoad = filteredLoads[0];

  const mapPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [];
    geoShipments.forEach((gs) => {
      if (gs.pickup) pts.push([gs.pickup.lat, gs.pickup.lng]);
      if (gs.delivery) pts.push([gs.delivery.lat, gs.delivery.lng]);
    });
    return pts;
  }, [geoShipments]);

  const mapCenter = geoShipments[0]?.pickup || { lat: -19.0154, lng: 29.1549 };

  return (
    <div className="fixed inset-0 z-0">
      {/* Full-screen zoomable map */}
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <DynamicTileLayer />
        {mapPoints.length > 0 && <FitBounds points={mapPoints} />}
        {geoShipments.map((gs) => (
          <span key={gs.load.id}>
            {gs.pickup && (
              <Marker
                position={[gs.pickup.lat, gs.pickup.lng]}
                icon={pickupIcon}
                eventHandlers={{ click: () => setSelectedLoad(gs.load) }}
              />
            )}
            {gs.delivery && (
              <Marker
                position={[gs.delivery.lat, gs.delivery.lng]}
                icon={deliveryIcon}
                eventHandlers={{ click: () => setSelectedLoad(gs.load) }}
              />
            )}
          </span>
        ))}
      </MapContainer>

      {/* Top bar: sidebar + search + filter */}
      <div className="absolute top-0 left-0 right-0 z-[1000] safe-top">
        <div className="mx-3 mt-3 flex items-center gap-2">
          <div className="h-11 w-11 rounded-full bg-card shadow-soft flex items-center justify-center shrink-0 [&_button]:!bg-transparent [&_button]:!shadow-none [&_button]:!h-11 [&_button]:!w-11">
            <AppSidebar role="shipper" />
          </div>
          <div className="flex-1 flex items-center gap-2 bg-card rounded-full shadow-soft px-4 h-11">
            <Search className="h-[16px] w-[16px] text-muted-foreground shrink-0" strokeWidth={1.8} />
            <input
              placeholder="Search shipments…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-[13px] font-medium placeholder:text-muted-foreground/60 min-w-0"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Filter"
                className="h-11 w-11 rounded-full bg-card shadow-soft flex items-center justify-center shrink-0"
              >
                <Filter className="h-[18px] w-[18px] text-foreground" strokeWidth={1.8} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-2xl shadow-pop">
              <DropdownMenuLabel className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">
                Status
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_FILTERS.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={statusFilter.includes(s)}
                  onCheckedChange={(checked) => {
                    setStatusFilter((prev) =>
                      checked ? [...prev, s] : prev.filter((x) => x !== s)
                    );
                  }}
                  className="text-[13px] font-medium"
                >
                  {STATUS_LABEL[s]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bottom sheet (3 snap states) */}
      <DraggableSheet
        height={sheetHeight}
        snaps={snaps}
        onSnap={snapTo}
        snapState={snapState}
        cycleSheet={cycleSheet}
      >
        <div className="px-4 pb-28">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredLoads.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                <Package className="h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
              </div>
              <p className="text-[14px] font-bold tracking-tight">No active shipments</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                {searchQuery ? 'No matches for your search' : 'Create a load to get started'}
              </p>
              {!searchQuery && (
                <Button
                  className="mt-4 rounded-full"
                  size="sm"
                  onClick={() => navigate('/shipper/create')}
                >
                  Post your first load
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {featuredLoad && (
                <div>
                  {snapState !== 'collapsed' && (
                    <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold mb-2">
                      Featured shipment
                    </p>
                  )}
                  <ShipmentCard
                    id={featuredLoad.tracking_code || featuredLoad.id.slice(0, 8).toUpperCase()}
                    status={featuredLoad.status}
                    pickupLocation={featuredLoad.pickup_location}
                    deliveryLocation={featuredLoad.delivery_location}
                    pickupDate={featuredLoad.pickup_date}
                    deliveryDate={featuredLoad.delivery_date}
                    pickupTime={featuredLoad.pickup_time}
                    deliveryTime={featuredLoad.delivery_time}
                    postedAt={featuredLoad.created_at}
                    price={featuredLoad.price}
                    truckType={featuredLoad.equipment_type}
                    onClick={() => setSelectedLoad(featuredLoad)}
                  />
                </div>
              )}

              {snapState !== 'collapsed' && filteredLoads.length > 1 && (
                <div className="space-y-3">
                  <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold pt-1 flex items-center justify-between">
                    <span>All shipments</span>
                    <span className="text-foreground">{filteredLoads.length - 1}</span>
                  </p>
                  {filteredLoads.slice(1).map((load: any) => (
                    <ShipmentCard
                      key={load.id}
                      id={load.tracking_code || load.id.slice(0, 8).toUpperCase()}
                      status={load.status}
                      pickupLocation={load.pickup_location}
                      deliveryLocation={load.delivery_location}
                      pickupDate={load.pickup_date}
                      deliveryDate={load.delivery_date}
                      pickupTime={load.pickup_time}
                      deliveryTime={load.delivery_time}
                      postedAt={load.created_at}
                      price={load.price}
                      truckType={load.equipment_type}
                      onClick={() => setSelectedLoad(load)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DraggableSheet>

      {/* Truck type mismatch warning dialog */}
      <Dialog open={!!mismatchPending} onOpenChange={(o) => !o && setMismatchPending(null)}>
        <DialogContent className="mx-4 rounded-[28px] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" /> Truck Type Mismatch
            </DialogTitle>
            <DialogDescription>The carrier's registered truck differs from what this load requires.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">This carrier's truck does not match the required equipment for this load.</p>
            <div className="rounded-2xl bg-warning/10 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Load requires:</span>
                <span className="font-semibold">{mismatchInfo?.requiredTruck}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Carrier has:</span>
                <span className="font-semibold">{mismatchInfo?.driverTruck}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plate:</span>
                <span className="font-mono font-bold">{mismatchInfo?.plate}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">You can still accept this bid, but the carrier's truck type differs from your requirements.</p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-full" onClick={() => setMismatchPending(null)}>Cancel</Button>
            <Button
              variant="default"
              className="flex-1 rounded-full bg-warning hover:bg-warning/90 text-black font-semibold"
              onClick={() => mismatchPending && acceptBid.mutate(mismatchPending)}
            >
              Accept Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shipment detail sheet */}
      <Sheet open={!!selectedLoad} onOpenChange={(o) => { if (!o) { setSelectedLoad(null); setShowLiveMap(false); setShowChat(false); } }}>
        <SheetContent side="bottom" className="h-[88vh] rounded-t-[32px] p-0 overflow-hidden bg-background">
          {selectedLoad && (
            <div className="flex flex-col h-full">
              <SheetHeader className="px-5 pt-6 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-left">
                    <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">
                      ID: {selectedLoad.tracking_code || selectedLoad.id.slice(0, 8).toUpperCase()}
                    </p>
                    <SheetTitle className="text-[22px] font-bold tracking-tight truncate mt-0.5">
                      {selectedLoad.title || 'Shipment'}
                    </SheetTitle>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${STATUS_PILL[selectedLoad.status] || ''}`}>
                    {STATUS_LABEL[selectedLoad.status] || selectedLoad.status}
                  </span>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
                <div className="bg-card rounded-[28px] shadow-soft p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/15" />
                      <div className="w-px h-8 bg-muted" />
                      <div className="h-3 w-3 rounded-full border-2 border-foreground" />
                    </div>
                    <div className="space-y-3 flex-1 min-w-0">
                      <div>
                        <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">Pickup</p>
                        <p className="text-[15px] font-bold mt-0.5 truncate">{selectedLoad.pickup_location}</p>
                      </div>
                      <div>
                        <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">Delivery</p>
                        <p className="text-[15px] font-bold mt-0.5 truncate">{selectedLoad.delivery_location}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card rounded-[28px] shadow-soft p-5">
                    <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">Price</p>
                    <p className="text-[26px] leading-none font-bold tracking-tight mt-2">
                      ${Number(selectedLoad.price || 0).toLocaleString()}
                    </p>
                  </div>
                  {selectedLoad.pickup_date && (
                    <div className="bg-card rounded-[28px] shadow-soft p-5">
                      <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">Pickup date</p>
                      <p className="text-[15px] font-bold mt-2.5">{format(new Date(selectedLoad.pickup_date), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  {selectedLoad.equipment_type && (
                    <div className="bg-card rounded-[28px] shadow-soft p-5">
                      <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">Equipment</p>
                      <p className="text-[15px] font-bold mt-2.5 truncate">{selectedLoad.equipment_type}</p>
                    </div>
                  )}
                  {selectedLoad.weight_lbs && (
                    <div className="bg-card rounded-[28px] shadow-soft p-5">
                      <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">Weight</p>
                      <p className="text-[15px] font-bold mt-2.5">{Number(selectedLoad.weight_lbs).toLocaleString()} lbs</p>
                    </div>
                  )}
                </div>

                {['accepted', 'in_transit'].includes(selectedLoad.status) && (
                  <div className="bg-card rounded-[28px] shadow-soft p-5">
                    <StatusMilestones currentStatus={selectedLoad.status} />
                  </div>
                )}

                {selectedLoad.status === 'posted' && (
                  <div className="bg-card rounded-[28px] shadow-soft p-5">
                    <p className="text-[15px] font-bold tracking-tight mb-3">Carrier Bids</p>
                    <BidList
                      loadId={selectedLoad.id}
                      onAcceptBid={(bidId, driverId, amount) =>
                        handleAcceptBidWithCheck(bidId, driverId, amount, selectedLoad.id)
                      }
                    />
                  </div>
                )}

                {selectedLoad.status === 'in_transit' && selectedLoad.driver_id && (
                  <div className="bg-card rounded-[28px] shadow-soft p-5 space-y-3">
                    <button
                      className="flex items-center gap-2 text-[13px] font-semibold text-amber-700 dark:text-amber-300"
                      onClick={() => setShowLiveMap(v => !v)}
                    >
                      <Satellite className="h-4 w-4" />
                      {showLiveMap ? 'Hide Live Map' : 'Show Live Tracking'}
                    </button>
                    {showLiveMap && (
                      <div className="rounded-[24px] overflow-hidden" style={{ height: 240 }}>
                        <LiveTrackingMap
                          loadId={selectedLoad.id}
                          driverId={selectedLoad.driver_id}
                          pickupLocation={selectedLoad.pickup_location}
                          deliveryLocation={selectedLoad.delivery_location}
                        />
                      </div>
                    )}
                  </div>
                )}

                {showChat && (
                  <div className="bg-card rounded-[28px] shadow-soft p-5">
                    <LoadChat loadId={selectedLoad.id} />
                  </div>
                )}
              </div>

              <div className="px-5 py-4 backdrop-blur-xl bg-background/85 border-t border-border/40 safe-area-bottom">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-full text-sm font-semibold"
                    onClick={() => setShowChat(!showChat)}
                  >
                    <MessageCircle className="h-4 w-4 mr-1.5" strokeWidth={2} /> Chat
                  </Button>
                  {selectedLoad.status === 'posted' && (
                    <Button
                      variant="destructive"
                      className="flex-1 h-12 rounded-full text-sm font-semibold"
                      onClick={async () => {
                        await supabase.from('loads').update({ status: 'cancelled' }).eq('id', selectedLoad.id);
                        queryClient.invalidateQueries({ queryKey: ['shipper-live-loads'] });
                        setSelectedLoad(null);
                        toast.success('Load cancelled');
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" strokeWidth={2} /> Cancel
                    </Button>
                  )}
                  {selectedLoad.status !== 'posted' && (
                    <Button
                      variant="default"
                      className="flex-1 h-12 rounded-full text-sm font-semibold"
                      onClick={() => {
                        setSelectedLoad(null);
                        navigate('/shipper/shipments');
                      }}
                    >
                      <MapPin className="h-4 w-4 mr-1.5" strokeWidth={2} /> Open shipment
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------------- Draggable bottom sheet ----------------

interface DraggableSheetProps {
  height: ReturnType<typeof useMotionValue<number>>;
  snaps: { collapsed: number; half: number; full: number };
  snapState: 'collapsed' | 'half' | 'full';
  onSnap: (s: 'collapsed' | 'half' | 'full') => void;
  cycleSheet: () => void;
  children: React.ReactNode;
}

function DraggableSheet({ height, snaps, snapState, onSnap, cycleSheet, children }: DraggableSheetProps) {
  const dragStartRef = useRef(0);

  const onDragEnd = (_e: any, info: { offset: { y: number }; velocity: { y: number } }) => {
    const current = height.get();
    const v = info.velocity.y;
    let target: 'collapsed' | 'half' | 'full' = snapState;

    if (v > 600) {
      target = snapState === 'full' ? 'half' : 'collapsed';
    } else if (v < -600) {
      target = snapState === 'collapsed' ? 'half' : 'full';
    } else {
      const distances = {
        collapsed: Math.abs(current - snaps.collapsed),
        half: Math.abs(current - snaps.half),
        full: Math.abs(current - snaps.full),
      };
      target = (Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0]) as any;
    }
    onSnap(target);
  };

  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 z-[900] backdrop-blur-xl bg-card/85 rounded-t-[32px] shadow-pop overflow-hidden flex flex-col"
      style={{ height }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0}
      onDragStart={() => { dragStartRef.current = height.get(); }}
      onDrag={(_, info) => {
        const next = Math.max(snaps.collapsed, Math.min(snaps.full + 60, dragStartRef.current - info.offset.y));
        height.set(next);
      }}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        onClick={cycleSheet}
        className="w-full pt-2.5 pb-2 flex flex-col items-center cursor-grab active:cursor-grabbing"
        aria-label="Toggle sheet"
      >
        <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center gap-1 mt-1.5">
          {snapState === 'full'
            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
            : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
        </div>
      </button>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </motion.div>
  );
}
