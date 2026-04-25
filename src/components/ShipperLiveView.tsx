import { useState, useEffect, useCallback, useMemo } from 'react';
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
  AlertTriangle, Package, MessageCircle, XCircle, Satellite,
  Bell, Search, Plus, Navigation as NavIcon, Eye, EyeOff,
  Box, ChevronRight, MapPin,
} from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import LoadChat from '@/components/LoadChat';
import StatusMilestones from '@/components/StatusMilestones';
import { BidList } from '@/components/BidSystem';
import LiveTrackingMap from '@/components/LiveTrackingMap';
import ShipmentCard from '@/components/shared/ShipmentCard';

// Leaflet defaults
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pickupIcon = new L.DivIcon({
  html: `<div style="background:#FBBF24;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 6px 18px rgba(251,191,36,0.45),0 2px 6px rgba(0,0,0,0.15);"><span style="width:6px;height:6px;background:#2D3436;border-radius:50%"></span></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: '',
});
const deliveryIcon = new L.DivIcon({
  html: `<div style="background:#2D3436;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.25);"><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  className: '',
});

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
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 11 });
    }
  }, [points, map]);
  return null;
}

export default function ShipperLiveView() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedLoad, setSelectedLoad] = useState<any | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [geoShipments, setGeoShipments] = useState<GeoShipment[]>([]);
  const [showLiveMap, setShowLiveMap] = useState(false);
  const [hideValue, setHideValue] = useState(false);
  const [mismatchPending, setMismatchPending] = useState<{ bidId: string; driverId: string; amount: number; loadId: string } | null>(null);
  const [mismatchInfo, setMismatchInfo] = useState<{ driverTruck: string; requiredTruck: string; plate: string } | null>(null);

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

  // Geocode (only first 8 for the inset preview map)
  useEffect(() => {
    if (!loads?.length) { setGeoShipments([]); return; }
    const slice = loads.slice(0, 8);
    const geo = async () => {
      const results: GeoShipment[] = [];
      for (let i = 0; i < slice.length; i += 3) {
        const batch = slice.slice(i, i + 3);
        const geos = await Promise.all(batch.map(async (load: any) => {
          const [pickup, delivery] = await Promise.all([
            geocode(load.pickup_location),
            geocode(load.delivery_location),
          ]);
          return { load, pickup: pickup || undefined, delivery: delivery || undefined } as GeoShipment;
        }));
        results.push(...geos);
        if (i + 3 < slice.length) await new Promise(r => setTimeout(r, 1100));
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

  // Aggregate stats
  const stats = useMemo(() => {
    if (!loads) return { active: 0, transit: 0, value: 0 };
    return {
      active: loads.length,
      transit: loads.filter((l: any) => l.status === 'in_transit').length,
      value: loads.reduce((sum: number, l: any) => sum + Number(l.price || 0), 0),
    };
  }, [loads]);

  const firstName = (profile?.full_name || user?.email || 'There').split(' ')[0];
  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();

  const mapPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [];
    geoShipments.forEach((gs) => {
      if (gs.pickup) pts.push([gs.pickup.lat, gs.pickup.lng]);
      if (gs.delivery) pts.push([gs.delivery.lat, gs.delivery.lng]);
    });
    return pts;
  }, [geoShipments]);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Frosted-glass scrolling header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 px-5 pt-5 pb-4 safe-top">
        <div className="flex items-center gap-3">
          <AppSidebar role="shipper" />
          <div className="h-11 w-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold tracking-tight shadow-soft shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">Shipper</p>
            <p className="text-[15px] font-bold tracking-tight text-foreground truncate">
              Hi, {firstName}
            </p>
          </div>
          <button
            className="h-11 w-11 rounded-full bg-card shadow-soft flex items-center justify-center"
            aria-label="Search"
          >
            <Search className="h-[18px] w-[18px] text-foreground" strokeWidth={1.8} />
          </button>
          <button
            className="h-11 w-11 rounded-full bg-card shadow-soft flex items-center justify-center relative"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px] text-foreground" strokeWidth={1.8} />
            {stats.transit > 0 && (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
            )}
          </button>
        </div>
      </header>

      <main className="px-5 mt-2 space-y-5">
        {/* Hero balance island */}
        <section className="bg-card rounded-[32px] shadow-soft p-6">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">
                Total shipment value
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-[40px] leading-none font-bold tracking-tight text-foreground">
                  {hideValue ? '••••••' : `$${stats.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </p>
                <button
                  className="text-muted-foreground"
                  onClick={() => setHideValue(v => !v)}
                  aria-label="Toggle value"
                >
                  {hideValue
                    ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    : <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} />}
                </button>
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground">{stats.active}</span> active ·{' '}
                <span className="font-semibold text-foreground">{stats.transit}</span> in transit
              </p>
            </div>
            <button
              onClick={() => navigate('/shipper/create')}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2.5 font-semibold text-[13px] shadow-soft active:scale-[0.97] transition-transform"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Post Load
            </button>
          </div>
        </section>

        {/* Quick action pills */}
        <section className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/shipper/create')}
            className="bg-card rounded-[28px] shadow-soft p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Plus className="h-[18px] w-[18px] text-amber-700 dark:text-amber-300" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-tight text-foreground">New Load</p>
              <p className="text-[11px] text-muted-foreground truncate">Post freight to carriers</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/shipper/shipments')}
            className="bg-card rounded-[28px] shadow-soft p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <NavIcon className="h-[18px] w-[18px] text-foreground" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-tight text-foreground">Track all</p>
              <p className="text-[11px] text-muted-foreground truncate">View every shipment</p>
            </div>
          </button>
        </section>

        {/* Inset map card */}
        {mapPoints.length > 0 && (
          <section className="bg-card rounded-[32px] shadow-soft overflow-hidden">
            <div className="relative">
              <div className="h-48">
                <MapContainer
                  center={mapPoints[0]}
                  zoom={7}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                  attributionControl={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  dragging={false}
                  touchZoom={false}
                >
                  <DynamicTileLayer />
                  <FitBounds points={mapPoints} />
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
              </div>
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 backdrop-blur px-3 py-1.5 shadow-soft">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="text-[10.5px] font-semibold tracking-tight text-foreground">LIVE</span>
              </div>
              <button
                onClick={() => navigate('/shipper/shipments')}
                className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-foreground/90 backdrop-blur text-background px-3 py-1.5 text-[11px] font-semibold shadow-soft"
              >
                Open map
                <ChevronRight className="h-3 w-3" strokeWidth={2.4} />
              </button>
            </div>
          </section>
        )}

        {/* Current Shipment section */}
        <section>
          <div className="flex items-baseline justify-between mb-3 px-1">
            <h2 className="text-[18px] font-bold tracking-tight text-foreground">Current Shipment</h2>
            <button
              onClick={() => navigate('/shipper/shipments')}
              className="text-[12px] font-semibold text-amber-700 dark:text-amber-300 inline-flex items-center gap-0.5"
            >
              See all <ChevronRight className="h-3 w-3" strokeWidth={2.4} />
            </button>
          </div>

          {isLoading ? (
            <div className="bg-card rounded-[28px] shadow-soft p-8 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !loads?.length ? (
            <div className="bg-card rounded-[32px] shadow-soft p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <Box className="h-7 w-7 text-muted-foreground" strokeWidth={1.6} />
              </div>
              <p className="text-[15px] font-bold tracking-tight">No active shipments</p>
              <p className="text-[12px] text-muted-foreground mt-1">Create a load to get started</p>
              <Button
                className="mt-5 rounded-full px-5"
                onClick={() => navigate('/shipper/create')}
              >
                <Plus className="h-4 w-4 mr-1.5" strokeWidth={2.4} />
                Post your first load
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {loads.slice(0, 6).map((load: any) => (
                <ShipmentCard
                  key={load.id}
                  id={load.tracking_code || load.id.slice(0, 8).toUpperCase()}
                  title={load.title || load.equipment_type || 'Shipment'}
                  status={load.status}
                  pickupLocation={load.pickup_location}
                  deliveryLocation={load.delivery_location}
                  pickupDate={load.pickup_date}
                  deliveryDate={load.delivery_date}
                  price={load.price}
                  onClick={() => setSelectedLoad(load)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

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
                {/* Route island */}
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

                {/* Stats grid */}
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

                {/* Status milestones */}
                {['accepted', 'in_transit'].includes(selectedLoad.status) && (
                  <div className="bg-card rounded-[28px] shadow-soft p-5">
                    <StatusMilestones currentStatus={selectedLoad.status} />
                  </div>
                )}

                {/* Bids */}
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

                {/* Live tracking */}
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

                {/* Chat */}
                {showChat && (
                  <div className="bg-card rounded-[28px] shadow-soft p-5">
                    <LoadChat loadId={selectedLoad.id} />
                  </div>
                )}
              </div>

              {/* Sticky actions */}
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
