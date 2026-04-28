import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet';
import DynamicTileLayer from '@/components/map/DynamicTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search, Sparkles, Radar, Package, ChevronUp, ChevronDown, Truck, Flame, X,
} from 'lucide-react';
import { motion, useMotionValue, animate } from 'framer-motion';
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

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom() < 8 ? 10 : map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

const GEOFENCE_KM = 100;

// Sheet snap points (px from bottom of viewport)
const SNAP_COLLAPSED = 132;
const SNAP_HALF = 0.5;
const SNAP_FULL = 0.78;

export default function DriverHomeView() {
  const { user } = useAuth();
  const { online, loads: localLoads } = useLocalFirstSnapshot();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null);
  const [selectedMatchScore, setSelectedMatchScore] = useState<number | undefined>();
  const [geoLoads, setGeoLoads] = useState<GeoLoad[]>([]);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sheet height (px). Three snap points.
  const snaps = useMemo(() => ({
    collapsed: SNAP_COLLAPSED,
    half: Math.round(vh * SNAP_HALF),
    full: Math.round(vh * SNAP_FULL),
  }), [vh]);

  const sheetHeight = useMotionValue(snaps.half);
  const [snapState, setSnapState] = useState<'collapsed' | 'half' | 'full'>('half');

  useEffect(() => {
    // Re-snap on resize
    const target = snaps[snapState];
    animate(sheetHeight, target, { type: 'spring', damping: 30, stiffness: 280 });
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

  const sortedLoads = useMemo(() => {
    return [...geofencedLoads].sort((a, b) => b.matchScore - a.matchScore);
  }, [geofencedLoads]);

  const featuredLoad = sortedLoads[0];

  const handleSelectLoad = (load: any, score?: number) => {
    setSelectedLoad(load);
    setSelectedMatchScore(score);
  };

  // Active route to top recommended (keeps the glowing amber polyline)
  const activeRoute: [number, number][] | null = useMemo(() => {
    if (!driverPos || !featuredLoad) return null;
    const geo = geoLoads.find((g) => g.id === featuredLoad.id);
    if (!geo) return null;
    return [[driverPos.lat, driverPos.lng], [geo.lat, geo.lng]];
  }, [driverPos, featuredLoad, geoLoads]);

  const mapCenter = driverPos || { lat: -19.0154, lng: 29.1549 };

  return (
    <div className="fixed inset-0 z-0">
      {/* Full-screen zoomable map */}
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={driverPos ? 10 : 6}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <DynamicTileLayer />
        {driverPos && <Recenter lat={driverPos.lat} lng={driverPos.lng} />}
        {driverPos && <Marker position={[driverPos.lat, driverPos.lng]} icon={driverIcon} />}
        {geoLoads.map((load) => (
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

      {/* Top bar: sidebar + search + filter */}
      <div className="absolute top-0 left-0 right-0 z-[1000] safe-top">
        <div className="mx-3 mt-3 flex items-center gap-2">
          <div className="h-11 w-11 rounded-full bg-card shadow-soft flex items-center justify-center shrink-0 [&_button]:!bg-transparent [&_button]:!shadow-none [&_button]:!h-11 [&_button]:!w-11">
            <AppSidebar role="driver" />
          </div>
          <div className="flex-1 flex items-center gap-2 bg-card rounded-full shadow-soft px-4 h-11">
            <Search className="h-[16px] w-[16px] text-muted-foreground shrink-0" strokeWidth={1.8} />
            <input
              placeholder="Search loads or locations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-[13px] font-medium placeholder:text-muted-foreground/60 min-w-0"
            />
            {online && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> LIVE
              </span>
            )}
          </div>
          <button
            onClick={() => setGeofenceEnabled(v => !v)}
            aria-label="Nearby"
            className={`h-11 w-11 rounded-full shadow-soft flex items-center justify-center shrink-0 transition-colors ${
              geofenceEnabled ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'
            }`}
          >
            <Radar className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          <div className="h-11 w-11 rounded-full bg-card shadow-soft flex items-center justify-center shrink-0 [&>*]:!h-11 [&>*]:!w-11 [&>*]:!min-h-0 [&>*]:!min-w-0 [&>*]:!rounded-full [&>*]:!bg-transparent [&>*]:!text-foreground [&>*]:!shadow-none [&>*]:!border-0">
            <DriverFilters filters={filters} onChange={setFilters} />
          </div>
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
          {/* Quick filter chips — visible inline so carriers can narrow loads with one tap */}
          {snapState !== 'collapsed' && (
            <QuickFilterChips
              filters={filters}
              onChange={setFilters}
              geofenceEnabled={geofenceEnabled}
              onToggleGeofence={() => setGeofenceEnabled((v) => !v)}
              totalCount={loads.length}
              shownCount={sortedLoads.length}
            />
          )}

          {sortedLoads.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                <Package className="h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
              </div>
              <p className="text-[14px] font-bold tracking-tight">No loads available</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                {geofenceEnabled ? `Nothing within ${GEOFENCE_KM}km` : 'Try adjusting filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Featured first */}
              {featuredLoad && (
                <div>
                  {snapState === 'collapsed' ? null : (
                    <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-primary" /> Best Match
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
                    viewerRole="driver"
                    bookmarkable
                    bookmarkId={featuredLoad.id}
                    onClick={() => handleSelectLoad(featuredLoad, featuredLoad.matchScore)}
                  />
                </div>
              )}

              {snapState !== 'collapsed' && sortedLoads.length > 1 && (
                <div className="space-y-3">
                  <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold pt-1 flex items-center justify-between">
                    <span>All loads</span>
                    <span className="text-foreground">{sortedLoads.length - 1}</span>
                  </p>
                  {sortedLoads.slice(1).map((load: any) => (
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
                      viewerRole="driver"
                      bookmarkable
                      bookmarkId={load.id}
                      onClick={() => handleSelectLoad(load, load.matchScore)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DraggableSheet>

      <LoadDetailModal
        load={selectedLoad}
        open={!!selectedLoad}
        onClose={() => { setSelectedLoad(null); setSelectedMatchScore(undefined); }}
        matchScore={selectedMatchScore}
      />
    </div>
  );
}

// ---------------- Inline quick-filter chips ----------------

const QUICK_EQUIPMENT = ['Flatbed', 'Refrigerated', 'Tanker', 'Container', 'Lowbed', 'Tipper'];

interface QuickFilterChipsProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  geofenceEnabled: boolean;
  onToggleGeofence: () => void;
  totalCount: number;
  shownCount: number;
}

function QuickFilterChips({
  filters,
  onChange,
  geofenceEnabled,
  onToggleGeofence,
  totalCount,
  shownCount,
}: QuickFilterChipsProps) {
  const toggleEquip = (eq: string) => {
    const has = filters.equipment.includes(eq);
    onChange({
      ...filters,
      equipment: has ? filters.equipment.filter((v) => v !== eq) : [...filters.equipment, eq],
    });
  };
  const activeCount =
    (filters.equipment.length > 0 ? 1 : 0) +
    (filters.cargoType.length > 0 ? 1 : 0) +
    (filters.minPrice > 0 ? 1 : 0) +
    (filters.urgentOnly ? 1 : 0) +
    (geofenceEnabled ? 1 : 0);
  const reset = () => {
    onChange(DEFAULT_FILTERS);
    if (geofenceEnabled) onToggleGeofence();
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-semibold">
          Showing {shownCount} of {totalCount}
        </p>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>
      <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 w-max pb-1">
          <button
            type="button"
            onClick={onToggleGeofence}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition-colors ${
              geofenceEnabled
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground'
            }`}
          >
            <Radar className="h-3 w-3" strokeWidth={2.2} /> Nearby
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filters, urgentOnly: !filters.urgentOnly })}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition-colors ${
              filters.urgentOnly
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-secondary text-foreground'
            }`}
          >
            <Flame className="h-3 w-3" strokeWidth={2.2} /> Urgent
          </button>
          {QUICK_EQUIPMENT.map((eq) => {
            const active = filters.equipment.includes(eq);
            return (
              <button
                key={eq}
                type="button"
                onClick={() => toggleEquip(eq)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-foreground'
                }`}
              >
                <Truck className="h-3 w-3" strokeWidth={2.2} /> {eq}
              </button>
            );
          })}
        </div>
      </div>
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
      // Swipe down hard
      target = snapState === 'full' ? 'half' : 'collapsed';
    } else if (v < -600) {
      // Swipe up hard
      target = snapState === 'collapsed' ? 'half' : 'full';
    } else {
      // Snap to nearest
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
      {/* Handle */}
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
