import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import DynamicTileLayer from '@/components/map/DynamicTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, ChevronUp, ChevronDown, Package, MessageCircle, XCircle, Navigation, Satellite } from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { motion } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import LoadChat from '@/components/LoadChat';
import StatusMilestones from '@/components/StatusMilestones';
import { BidList } from '@/components/BidSystem';
import LiveTrackingMap from '@/components/LiveTrackingMap';

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pickupIcon = new L.DivIcon({
  html: `<div style="background:#FBBF24;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 6px 18px rgba(251,191,36,0.45),0 2px 6px rgba(0,0,0,0.15);"><svg width="14" height="14" viewBox="0 0 24 24" fill="#2D3436"><circle cx="12" cy="12" r="4"/></svg></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  className: '',
});

const deliveryIcon = new L.DivIcon({
  html: `<div style="background:#2D3436;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.25);"><svg width="13" height="13" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
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

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
}

const statusPill: Record<string, string> = {
  posted: 'pill pill-amber',
  accepted: 'pill pill-amber',
  in_transit: 'pill pill-warning',
  delivered: 'pill pill-success',
  cancelled: 'pill pill-danger',
};

const SNAP_COLLAPSED = 0.12;
const SNAP_HALF = 0.38;
const SNAP_FULL = 0.85;

interface GeoShipment {
  load: any;
  pickup?: { lat: number; lng: number };
  delivery?: { lat: number; lng: number };
}

export default function ShipperLiveView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sheetHeight, setSheetHeight] = useState(SNAP_HALF);
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [geoShipments, setGeoShipments] = useState<GeoShipment[]>([]);
  const [showLiveMap, setShowLiveMap] = useState(false);
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

  // Geocode
  useEffect(() => {
    if (!loads?.length) { setGeoShipments([]); return; }
    const geo = async () => {
      const results: GeoShipment[] = [];
      for (let i = 0; i < loads.length; i += 3) {
        const batch = loads.slice(i, i + 3);
        const geos = await Promise.all(batch.map(async (load: any) => {
          const [pickup, delivery] = await Promise.all([geocode(load.pickup_location), geocode(load.delivery_location)]);
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shipper-live-loads'] }); toast.success('Bid accepted!'); setMismatchPending(null); setMismatchInfo(null); },
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

  const toggleSheet = () => {
    if (sheetHeight <= SNAP_COLLAPSED) setSheetHeight(SNAP_HALF);
    else if (sheetHeight <= SNAP_HALF) setSheetHeight(SNAP_FULL);
    else setSheetHeight(SNAP_HALF);
  };

  const mapCenter = geoShipments[0]?.pickup || { lat: -19.0154, lng: 29.1549 };

  return (
    <div className="fixed inset-0 z-0">
      {/* Full-screen map */}
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <DynamicTileLayer />

        {geoShipments.map((gs) => (
          <span key={gs.load.id}>
            {gs.pickup && (
              <Marker position={[gs.pickup.lat, gs.pickup.lng]} icon={pickupIcon}
                eventHandlers={{ click: () => setSelectedLoad(gs.load) }}>
                <Popup><div className="min-w-[120px]"><p className="font-semibold text-xs">Pickup</p><p className="text-xs">{gs.load.pickup_location}</p></div></Popup>
              </Marker>
            )}
            {gs.delivery && (
              <Marker position={[gs.delivery.lat, gs.delivery.lng]} icon={deliveryIcon}
                eventHandlers={{ click: () => setSelectedLoad(gs.load) }}>
                <Popup><div className="min-w-[120px]"><p className="font-semibold text-xs">Delivery</p><p className="text-xs">{gs.load.delivery_location}</p></div></Popup>
              </Marker>
            )}
          </span>
        ))}
      </MapContainer>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] safe-top">
        <div className="mx-3 mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AppSidebar role="shipper" />
            <div className="glass shadow-soft rounded-full px-3.5 py-2 flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" strokeWidth={2} />
              <span className="text-[12px] font-semibold tracking-tight">Live Control</span>
            </div>
          </div>
          <div className="glass shadow-soft rounded-full px-3 py-1.5 text-[10.5px] font-semibold">
            {loads?.length || 0} active
          </div>
        </div>
      </div>

      {/* Draggable bottom sheet */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-[1000] glass-strong rounded-t-3xl shadow-pop"
        style={{ height: `${sheetHeight * 100}vh` }}
        animate={{ height: `${sheetHeight * 100}vh` }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex flex-col items-center pt-2 pb-1 cursor-grab" onClick={toggleSheet}>
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          <div className="flex items-center gap-1 mt-1">
            {sheetHeight >= SNAP_FULL ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
            <span className="text-[10px] text-muted-foreground font-medium">
              {loads?.length || 0} active shipments
            </span>
          </div>
        </div>

        <div className="overflow-y-auto px-3 pb-24" style={{ height: `calc(${sheetHeight * 100}vh - 44px)` }}>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : !loads?.length ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No active shipments</p>
              <p className="text-xs text-muted-foreground mt-1">Create a load to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {loads.map((load: any) => (
                <Card key={load.id} className="overflow-hidden cursor-pointer hover:shadow-float transition-shadow"
                  onClick={() => setSelectedLoad(load)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className={statusPill[load.status] || 'pill pill-muted'}>
                        {load.status.replace('_', ' ')}
                      </span>
                      <span className="text-base font-bold tracking-tight">${Number(load.price || 0).toFixed(0)}</span>
                    </div>
                    <div className="flex items-start gap-3 mb-2">
                      <div className="flex flex-col items-center gap-0.5 pt-1">
                        <div className="h-2 w-2 rounded-full bg-primary ring-4 ring-primary/15" />
                        <div className="w-px h-5 bg-muted" />
                        <div className="h-2 w-2 rounded-full border-2 border-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-[13px] font-semibold truncate">{load.pickup_location}</p>
                        <p className="text-[13px] font-medium truncate text-muted-foreground">{load.delivery_location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 text-[10.5px] text-muted-foreground">
                      <span className="font-semibold text-foreground truncate">{load.title}</span>
                      <span className="ml-auto shrink-0">{formatDistanceToNow(new Date(load.created_at), { addSuffix: true })}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Truck type mismatch warning dialog */}
      <Dialog open={!!mismatchPending} onOpenChange={(o) => !o && setMismatchPending(null)}>
        <DialogContent className="mx-4 rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" /> Truck Type Mismatch
            </DialogTitle>
            <DialogDescription>The carrier's registered truck differs from what this load requires.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">This carrier's truck does not match the required equipment for this load.</p>
            <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 space-y-1.5 text-sm">
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
            <Button variant="outline" className="flex-1" onClick={() => setMismatchPending(null)}>Cancel</Button>
            <Button
              variant="default"
              className="flex-1 bg-warning hover:bg-warning/90 text-black font-semibold"
              onClick={() => mismatchPending && acceptBid.mutate(mismatchPending)}
            >
              Accept Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shipment detail modal */}
      <Sheet open={!!selectedLoad} onOpenChange={(o) => { if (!o) { setSelectedLoad(null); setShowLiveMap(false); } }}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 overflow-hidden">
          {selectedLoad && (
            <div className="flex flex-col h-full">
              <SheetHeader className="p-5 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <SheetTitle className="text-lg font-bold tracking-tight truncate">{selectedLoad.title}</SheetTitle>
                  <span className={statusPill[selectedLoad.status] || 'pill pill-muted'}>
                    {selectedLoad.status.replace('_', ' ')}
                  </span>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Route island */}
                <div className="island p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-0.5 pt-1">
                      <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/15" />
                      <div className="w-px h-8 bg-muted" />
                      <div className="h-3 w-3 rounded-full border-2 border-foreground" />
                    </div>
                    <div className="space-y-3 flex-1 min-w-0">
                      <div>
                        <p className="heavy-label">Pickup</p>
                        <p className="text-sm font-semibold mt-0.5 truncate">{selectedLoad.pickup_location}</p>
                      </div>
                      <div>
                        <p className="heavy-label">Delivery</p>
                        <p className="text-sm font-semibold mt-0.5 truncate">{selectedLoad.delivery_location}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details — islands */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="island p-4">
                    <p className="heavy-label">Price</p>
                    <p className="text-2xl font-bold text-foreground tracking-tight mt-1">
                      ${Number(selectedLoad.price || 0).toLocaleString()}
                    </p>
                  </div>
                  {selectedLoad.pickup_date && (
                    <div className="island p-4">
                      <p className="heavy-label">Pickup date</p>
                      <p className="text-sm font-semibold mt-1.5">{format(new Date(selectedLoad.pickup_date), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                </div>

                {/* Status milestones */}
                {['accepted', 'in_transit'].includes(selectedLoad.status) && (
                  <StatusMilestones currentStatus={selectedLoad.status} />
                )}

                {/* Bids for posted loads */}
                {selectedLoad.status === 'posted' && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Carrier Bids</p>
                    <BidList
                      loadId={selectedLoad.id}
                      onAcceptBid={(bidId, driverId, amount) =>
                        handleAcceptBidWithCheck(bidId, driverId, amount, selectedLoad.id)
                      }
                    />
                  </div>
                )}

                {/* Live tracking for in_transit loads */}
                {selectedLoad.status === 'in_transit' && selectedLoad.driver_id && (
                  <div className="space-y-2">
                    <button
                      className="flex items-center gap-2 text-sm font-semibold text-primary"
                      onClick={() => setShowLiveMap(v => !v)}
                    >
                      <Satellite className="h-4 w-4" />
                      {showLiveMap ? 'Hide Live Map' : 'Show Live Tracking'}
                    </button>
                    {showLiveMap && (
                      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 220 }}>
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
                  <div className="border-t border-border pt-3">
                    <LoadChat loadId={selectedLoad.id} />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-border p-4 bg-card space-y-2">
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-10 text-sm" onClick={() => setShowChat(!showChat)}>
                    <MessageCircle className="h-4 w-4 mr-1" /> Chat
                  </Button>
                  {selectedLoad.status === 'posted' && (
                    <Button variant="destructive" className="flex-1 h-10 text-sm"
                      onClick={async () => {
                        await supabase.from('loads').update({ status: 'cancelled' }).eq('id', selectedLoad.id);
                        queryClient.invalidateQueries({ queryKey: ['shipper-live-loads'] });
                        setSelectedLoad(null);
                        toast.success('Load cancelled');
                      }}>
                      <XCircle className="h-4 w-4 mr-1" /> Cancel
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
