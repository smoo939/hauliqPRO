import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet';
import DynamicTileLayer from '@/components/map/DynamicTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Switch } from '@/components/ui/switch';
import {
  Search, Sparkles, Bell, Box, Radar, SlidersHorizontal,
  Flame, Truck, Package, ChevronRight,
} from 'lucide-react';
import { SubscriptionBadge } from '@/components/driver/SubscriptionPaywall';
import { motion } from 'framer-motion';
import LoadDetailModal from '@/components/driver/LoadDetailModal';
import DriverFilters, { Filters, DEFAULT_FILTERS } from '@/components/driver/DriverFilters';
import AppSidebar from '@/components/AppSidebar';
import ShipmentCard from '@/components/shared/ShipmentCard';
import { calculateMatchScore } from '@/lib/matchScore';
import { useLocalFirstSnapshot } from '@/lib/localFirst';

// Leaflet defaults
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const loadPinIcon = new L.DivIcon({
  html: `<div style="background:#FBBF24;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #ffffff;box-shadow:0 6px 16px rgba(251,191,36,0.45),0 2px 6px rgba(0,0,0,0.12);"><span style="width:6px;height:6px;background:#2D3436;border-radius:50%"></span></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  className: '',
});

const urgentPinIcon = new L.DivIcon({
  html: `<div style="background:#2D3436;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #FBBF24;box-shadow:0 6px 16px rgba(0,0,0,0.25);font-size:11px;">🚨</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  className: '',
});

const driverIcon = new L.DivIcon({
  html: `<div style="background:#FBBF24;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #ffffff;box-shadow:0 6px 18px rgba(251,191,36,0.55),0 2px 8px rgba(0,0,0,0.18);">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2D3436" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
    </svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  className: '',
});

interface GeoLoad {
  id: string;
  title: string;
  pickup_location: string;
  delivery_location: string;
  price: number | null;
  status: string;
  pickup_date: string | null;
  equipment_type: string | null;
  urgent: boolean | null;
  weight_lbs: number | null;
  load_type: string | null;
  created_at: string;
  description: string | null;
  shipper_id: string;
  tracking_code: string | null;
  lat: number;
  lng: number;
}

const geoCache = new Map<string, { lat: number; lng: number }>();
async function geocode(location: string): Promise<{ lat: number; lng: number } | null> {
  if (geoCache.has(location)) return geoCache.get(location)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location + ', Zimbabwe')}&format=json&limit=1`
    );
    const data = await res.json();
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geoCache.set(location, result);
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11, { animate: true });
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [25, 25], maxZoom: 11 });
    }
  }, [points, map]);
  return null;
}

const GEOFENCE_KM = 100;

export default function DriverHomeView() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { online, loads: localLoads } = useLocalFirstSnapshot();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null);
  const [selectedMatchScore, setSelectedMatchScore] = useState<number | undefined>();
  const [geoLoads, setGeoLoads] = useState<GeoLoad[]>([]);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);

  // Driver GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const loads = useMemo(() => localLoads.filter((load) => load.status === 'posted').slice(0, 60), [localLoads]);
  const isLoading = false;

  // Geocode pickup locations
  useEffect(() => {
    if (!loads?.length) return;
    const geocodeAll = async () => {
      const results: GeoLoad[] = [];
      for (let i = 0; i < loads.length; i += 3) {
        const batch = loads.slice(i, i + 3);
        const geos = await Promise.all(
          batch.map(async (load: any) => {
            const coords = await geocode(load.pickup_location);
            if (coords) return { ...load, lat: coords.lat, lng: coords.lng } as GeoLoad;
            return null;
          })
        );
        results.push(...(geos.filter(Boolean) as GeoLoad[]));
        if (i + 3 < loads.length) await new Promise((r) => setTimeout(r, 1100));
      }
      setGeoLoads(results);
    };
    geocodeAll();
  }, [loads]);

  // Filter + search
  const filteredLoads = useMemo(() => {
    if (!loads) return [];
    return loads.filter((l: any) => {
      if (filters.minPrice > 0 && (l.price || 0) < filters.minPrice) return false;
      if (filters.equipment.length && !filters.equipment.includes(l.equipment_type || '')) return false;
      if (filters.cargoType.length && !filters.cargoType.includes(l.load_type || '')) return false;
      if (filters.urgentOnly && !l.urgent) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          l.pickup_location?.toLowerCase().includes(q) ||
          l.delivery_location?.toLowerCase().includes(q) ||
          l.title?.toLowerCase().includes(q) ||
          l.equipment_type?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [loads, filters, searchQuery]);

  // AI Match Scores
  const scoredLoads = useMemo(() => {
    return filteredLoads.map((load: any) => {
      const geoLoad = geoLoads.find((g) => g.id === load.id);
      const score = calculateMatchScore({
        load: { ...load, lat: geoLoad?.lat, lng: geoLoad?.lng },
        driverLat: driverPos?.lat,
        driverLng: driverPos?.lng,
      });
      const distKm = geoLoad && driverPos
        ? haversineKm(driverPos.lat, driverPos.lng, geoLoad.lat, geoLoad.lng)
        : null;
      return { ...load, matchScore: score, distKm };
    });
  }, [filteredLoads, geoLoads, driverPos]);

  // 100km geofence
  const geofencedLoads = useMemo(() => {
    if (!geofenceEnabled || !driverPos) return scoredLoads;
    return scoredLoads.filter((load: any) => {
      if (load.distKm == null) return true;
      return load.distKm <= GEOFENCE_KM;
    });
  }, [scoredLoads, driverPos, geofenceEnabled]);

  const recommendedLoads = useMemo(() => {
    return [...geofencedLoads]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3)
      .filter((l) => l.matchScore >= 30);
  }, [geofencedLoads]);

  const otherLoads = useMemo(() => {
    const recIds = new Set(recommendedLoads.map((l: any) => l.id));
    return geofencedLoads.filter((l: any) => !recIds.has(l.id));
  }, [geofencedLoads, recommendedLoads]);

  const totalAvailable = geofencedLoads.length;
  const avgPrice = useMemo(() => {
    if (!geofencedLoads.length) return 0;
    return geofencedLoads.reduce((s: number, l: any) => s + Number(l.price || 0), 0) / geofencedLoads.length;
  }, [geofencedLoads]);

  const handleSelectLoad = (load: any, score?: number) => {
    setSelectedLoad(load);
    setSelectedMatchScore(score);
  };

  const firstName = (profile?.full_name || user?.email || 'There').split(' ')[0];
  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();

  // Map points
  const mapPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [];
    if (driverPos) pts.push([driverPos.lat, driverPos.lng]);
    geoLoads.slice(0, 12).forEach((g) => pts.push([g.lat, g.lng]));
    return pts;
  }, [driverPos, geoLoads]);

  // Active route to top recommended
  const activeRoute: [number, number][] | null = useMemo(() => {
    if (!driverPos) return null;
    const top = recommendedLoads[0];
    if (!top) return null;
    const geo = geoLoads.find((g) => g.id === top.id);
    if (!geo) return null;
    return [[driverPos.lat, driverPos.lng], [geo.lat, geo.lng]];
  }, [driverPos, recommendedLoads, geoLoads]);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Frosted-glass scrolling header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 px-5 pt-5 pb-4 safe-top">
        <div className="flex items-center gap-3">
          <AppSidebar role="driver" />
          <div className="h-11 w-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold tracking-tight shadow-soft shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">Carrier</p>
            <p className="text-[15px] font-bold tracking-tight text-foreground truncate">
              Hi, {firstName}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-card shadow-soft px-3 h-11">
            <span className={`text-[10px] font-bold tracking-tight ${online ? 'text-foreground' : 'text-muted-foreground'}`}>
              {online ? 'ONLINE' : 'OFFLINE'}
            </span>
            <Switch checked={online} disabled className="h-4 w-7 data-[state=checked]:bg-primary" />
          </div>
          <button
            className="h-11 w-11 rounded-full bg-card shadow-soft flex items-center justify-center relative shrink-0"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px] text-foreground" strokeWidth={1.8} />
            {totalAvailable > 0 && (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
            )}
          </button>
        </div>
      </header>

      <main className="px-5 mt-2 space-y-5">
        {/* Hero island — Available Loads */}
        <section className="bg-card rounded-[32px] shadow-soft p-6">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">
                Available loads
              </p>
              <p className="mt-1 text-[44px] leading-none font-bold tracking-tight text-foreground">
                {totalAvailable}
              </p>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Avg payout{' '}
                <span className="font-semibold text-foreground">
                  ${avgPrice.toFixed(0)}
                </span>
                {driverPos && (
                  <>
                    {' '}·{' '}
                    <span className="font-semibold text-foreground">
                      {geoLoads.length}
                    </span>{' '}
                    on map
                  </>
                )}
              </p>
            </div>
            <div className="shrink-0">
              <SubscriptionBadge />
            </div>
          </div>
        </section>

        {/* Search + filter pill row */}
        <section className="flex items-center gap-2.5">
          <div className="flex-1 flex items-center gap-2.5 bg-card rounded-full shadow-soft px-4 h-12">
            <Search className="h-[16px] w-[16px] text-muted-foreground shrink-0" strokeWidth={1.8} />
            <input
              placeholder="Search loads or locations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-[13px] font-medium placeholder:text-muted-foreground/60"
            />
          </div>
          <button
            onClick={() => setGeofenceEnabled(!geofenceEnabled)}
            aria-label="Nearby toggle"
            className={`h-12 w-12 rounded-full flex items-center justify-center shadow-soft transition-colors ${
              geofenceEnabled
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground'
            }`}
          >
            <Radar className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          <div className="h-12 w-12 rounded-full bg-foreground text-background shadow-soft flex items-center justify-center [&>*]:!h-12 [&>*]:!w-12 [&>*]:!min-h-0 [&>*]:!min-w-0 [&>*]:!rounded-full [&>*]:!bg-transparent [&>*]:!text-background [&>*]:!shadow-none [&>*]:!border-0">
            <DriverFilters filters={filters} onChange={setFilters} />
          </div>
        </section>

        {/* Inset map card — John Davidson style */}
        <section className="bg-card rounded-[32px] shadow-soft overflow-hidden">
          <div className="relative">
            <div className="h-56">
              <MapContainer
                center={driverPos ? [driverPos.lat, driverPos.lng] : [-19.0154, 29.1549]}
                zoom={driverPos ? 10 : 6}
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
                {driverPos && <Marker position={[driverPos.lat, driverPos.lng]} icon={driverIcon} />}
                {geoLoads.slice(0, 12).map((load) => (
                  <Marker
                    key={load.id}
                    position={[load.lat, load.lng]}
                    icon={load.urgent ? urgentPinIcon : loadPinIcon}
                    eventHandlers={{ click: () => handleSelectLoad(load) }}
                  />
                ))}
                {activeRoute && (
                  <>
                    <Polyline positions={activeRoute} pathOptions={{ color: '#FBBF24', weight: 12, opacity: 0.18, lineCap: 'round' }} />
                    <Polyline positions={activeRoute} pathOptions={{ color: '#FBBF24', weight: 6, opacity: 0.35, lineCap: 'round' }} />
                    <Polyline positions={activeRoute} pathOptions={{ color: '#FBBF24', weight: 3.2, opacity: 1, lineCap: 'round', dashArray: '6 8' }} />
                  </>
                )}
              </MapContainer>
            </div>
            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 backdrop-blur px-3 py-1.5 shadow-soft">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-[10.5px] font-semibold tracking-tight text-foreground">
                {geoLoads.length} pinned
              </span>
            </div>
            {recommendedLoads[0] && (
              <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-card/95 backdrop-blur shadow-soft px-3 py-2.5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Truck className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">
                    Best match nearby
                  </p>
                  <p className="text-[13px] font-bold tracking-tight truncate text-foreground">
                    {recommendedLoads[0].pickup_location} → {recommendedLoads[0].delivery_location}
                  </p>
                </div>
                <button
                  onClick={() => handleSelectLoad(recommendedLoads[0], recommendedLoads[0].matchScore)}
                  className="shrink-0 h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center shadow-soft"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* AI Recommended */}
        {recommendedLoads.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" strokeWidth={1.8} />
                <h2 className="text-[18px] font-bold tracking-tight text-foreground">AI Recommended</h2>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold">
                  <Sparkles className="h-2.5 w-2.5" /> Smart
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {recommendedLoads.map((load: any) => (
                <ShipmentCard
                  key={`rec-${load.id}`}
                  id={load.tracking_code || load.id.slice(0, 8).toUpperCase()}
                  title={load.title || load.equipment_type || 'Load'}
                  status={load.status}
                  pickupLocation={load.pickup_location}
                  deliveryLocation={load.delivery_location}
                  pickupDate={load.pickup_date}
                  deliveryDate={load.delivery_date}
                  price={load.price}
                  thumbnailIcon={<Box className="h-5 w-5 text-amber-700 dark:text-amber-300" strokeWidth={1.8} />}
                  onClick={() => handleSelectLoad(load, load.matchScore)}
                  rightSlot={
                    <div className="text-right shrink-0">
                      <p className="text-[15px] font-bold tracking-tight text-foreground">
                        ${Number(load.price || 0).toLocaleString()}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground font-semibold mt-0.5">
                        {load.distKm != null ? `${load.distKm.toFixed(0)} km` : `${Math.round(load.matchScore)}% match`}
                      </p>
                    </div>
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* All loads */}
        <section>
          <div className="flex items-baseline justify-between mb-3 px-1">
            <h2 className="text-[18px] font-bold tracking-tight text-foreground">
              {recommendedLoads.length > 0 ? 'All Loads' : 'Available Loads'}
            </h2>
            <span className="text-[12px] text-muted-foreground">
              {otherLoads.length}{geofenceEnabled ? ` · ≤${GEOFENCE_KM}km` : ''}
            </span>
          </div>

          {isLoading ? (
            <div className="bg-card rounded-[28px] shadow-soft p-8 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : geofencedLoads.length === 0 ? (
            <div className="bg-card rounded-[32px] shadow-soft p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <Package className="h-7 w-7 text-muted-foreground" strokeWidth={1.6} />
              </div>
              <p className="text-[15px] font-bold tracking-tight">No loads found</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                {geofenceEnabled
                  ? `No loads within ${GEOFENCE_KM}km — try the nearby toggle`
                  : 'Try adjusting filters or check back soon'}
              </p>
            </div>
          ) : otherLoads.length === 0 ? null : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {otherLoads.map((load: any) => (
                <ShipmentCard
                  key={load.id}
                  id={load.tracking_code || load.id.slice(0, 8).toUpperCase()}
                  title={load.title || load.equipment_type || 'Load'}
                  status={load.status}
                  pickupLocation={load.pickup_location}
                  deliveryLocation={load.delivery_location}
                  pickupDate={load.pickup_date}
                  deliveryDate={load.delivery_date}
                  price={load.price}
                  thumbnailIcon={<Box className="h-5 w-5 text-muted-foreground" strokeWidth={1.6} />}
                  onClick={() => handleSelectLoad(load, load.matchScore)}
                  rightSlot={
                    <div className="text-right shrink-0">
                      <p className="text-[15px] font-bold tracking-tight text-foreground">
                        ${Number(load.price || 0).toLocaleString()}
                      </p>
                      {load.distKm != null && (
                        <p className="text-[10.5px] text-muted-foreground font-semibold mt-0.5">
                          {load.distKm.toFixed(0)} km
                        </p>
                      )}
                    </div>
                  }
                />
              ))}
            </motion.div>
          )}
        </section>
      </main>

      <LoadDetailModal
        load={selectedLoad}
        open={!!selectedLoad}
        onClose={() => { setSelectedLoad(null); setSelectedMatchScore(undefined); }}
        matchScore={selectedMatchScore}
      />
    </div>
  );
}
