import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import DynamicTileLayer from '@/components/map/DynamicTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Search, Sparkles, Flame, ChevronUp, ChevronDown, Radar } from 'lucide-react';
import { SubscriptionBadge } from '@/components/driver/SubscriptionPaywall';
import { motion } from 'framer-motion';
import LoadCard from '@/components/driver/LoadCard';
import LoadDetailModal from '@/components/driver/LoadDetailModal';
import DriverFilters, { Filters, DEFAULT_FILTERS } from '@/components/driver/DriverFilters';
import AppSidebar from '@/components/AppSidebar';
import { calculateMatchScore } from '@/lib/matchScore';
import { useLocalFirstSnapshot } from '@/lib/localFirst';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Electric Amber load pin
const loadPinIcon = new L.DivIcon({
  html: `<div style="background:#FFBF00;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid rgba(0,0,0,0.5);box-shadow:0 2px 12px rgba(255,191,0,0.5);font-size:13px;">📦</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  className: '',
});

const urgentPinIcon = new L.DivIcon({
  html: `<div style="background:#ef4444;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid rgba(0,0,0,0.5);box-shadow:0 2px 12px rgba(239,68,68,0.5);font-size:14px;">🚨</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: '',
});

// Amber driver icon
const driverIcon = new L.DivIcon({
  html: `<div style="background:#FFBF00;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid rgba(0,0,0,0.6);box-shadow:0 2px 16px rgba(255,191,0,0.6);">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
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

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

const SNAP_COLLAPSED = 0.12;
const SNAP_HALF = 0.42;
const SNAP_FULL = 0.86;
const GEOFENCE_KM = 100;

export default function DriverHomeView() {
  const { user } = useAuth();
  const { online, loads: localLoads } = useLocalFirstSnapshot();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null);
  const [selectedMatchScore, setSelectedMatchScore] = useState<number | undefined>();
  const [geoLoads, setGeoLoads] = useState<GeoLoad[]>([]);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [sheetHeight, setSheetHeight] = useState(SNAP_HALF);
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
  const isLoading = !!user && loads.length === 0 && online;

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

  // 100km geofence filter
  const geofencedLoads = useMemo(() => {
    if (!geofenceEnabled || !driverPos) return scoredLoads;
    return scoredLoads.filter((load: any) => {
      if (load.distKm == null) return true; // Keep un-geocoded loads
      return load.distKm <= GEOFENCE_KM;
    });
  }, [scoredLoads, driverPos, geofenceEnabled]);

  // AI Recommended: top 5 by match score
  const recommendedLoads = useMemo(() => {
    return [...geofencedLoads]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5)
      .filter((l) => l.matchScore >= 30);
  }, [geofencedLoads]);

  // All other loads
  const otherLoads = useMemo(() => {
    const recIds = new Set(recommendedLoads.map((l: any) => l.id));
    return geofencedLoads.filter((l: any) => !recIds.has(l.id));
  }, [geofencedLoads, recommendedLoads]);

  const toggleSheet = () => {
    if (sheetHeight <= SNAP_COLLAPSED) setSheetHeight(SNAP_HALF);
    else if (sheetHeight <= SNAP_HALF) setSheetHeight(SNAP_FULL);
    else setSheetHeight(SNAP_HALF);
  };

  const handleSelectLoad = (load: any, score?: number) => {
    setSelectedLoad(load);
    setSelectedMatchScore(score);
  };

  const mapCenter = driverPos || { lat: -19.0154, lng: 29.1549 };

  return (
    <div className="fixed inset-0 z-0">
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={driverPos ? 10 : 6}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <DynamicTileLayer />
        {driverPos && <RecenterMap lat={driverPos.lat} lng={driverPos.lng} />}
        {driverPos && (
          <Marker position={[driverPos.lat, driverPos.lng]} icon={driverIcon}>
            <Popup>
              <div className="text-xs font-bold text-foreground">📍 Your position</div>
            </Popup>
          </Marker>
        )}
        {geoLoads.map((load) => (
          <Marker
            key={load.id}
            position={[load.lat, load.lng]}
            icon={load.urgent ? urgentPinIcon : loadPinIcon}
            eventHandlers={{ click: () => handleSelectLoad(load) }}
          >
            <Popup>
              <div className="min-w-[170px] space-y-1">
                <p className="font-black text-sm">{load.tracking_code || load.title}</p>
                <p className="text-xs text-muted-foreground">{load.pickup_location} → {load.delivery_location}</p>
                <p className="text-base font-black" style={{ color: '#FFBF00' }}>${Number(load.price || 0).toLocaleString()}</p>
                {load.equipment_type && <p className="text-xs text-muted-foreground">🚛 {load.equipment_type}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] safe-top">
        <div className="mx-3 mt-3 flex items-center gap-2">
          <AppSidebar role="driver" />

          <div className="flex-1 flex items-center gap-1.5 bg-card/90 backdrop-blur-md rounded-full px-3 py-2 border border-border shadow-lg">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              placeholder="Search loads or locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-transparent h-6 text-xs p-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Online indicator */}
          <div className="flex items-center gap-1 bg-card/90 backdrop-blur-md rounded-full px-2.5 py-2 border border-border shadow-lg shrink-0">
            <span className={`text-[9px] font-bold ${online ? 'text-success' : 'text-muted-foreground'}`}>
              {online ? 'LIVE' : 'OFF'}
            </span>
            <Switch checked={online} disabled className="h-4 w-7 data-[state=checked]:bg-success" />
          </div>

          <DriverFilters filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* Geofence toggle pill */}
      <div className="absolute top-16 left-3 z-[1000]">
        <button
          onClick={() => setGeofenceEnabled(!geofenceEnabled)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border backdrop-blur-md shadow-md transition-all ${
            geofenceEnabled
              ? 'bg-primary text-primary-foreground border-primary/50'
              : 'bg-card/85 text-muted-foreground border-border'
          }`}
        >
          <Radar className="h-3 w-3" />
          {geofenceEnabled ? `≤${GEOFENCE_KM}km` : 'Nearby'}
        </button>
      </div>

      {/* Subscription badge */}
      <div className="absolute top-16 right-3 z-[1000]">
        <SubscriptionBadge />
      </div>

      {/* Bottom sheet */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-[1000] bg-background rounded-t-3xl border-t border-border/60 shadow-2xl"
        style={{ height: `${sheetHeight * 100}vh` }}
        animate={{ height: `${sheetHeight * 100}vh` }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Drag handle */}
        <div className="flex flex-col items-center pt-3 pb-1 cursor-pointer" onClick={toggleSheet}>
          <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
          <div className="flex items-center gap-1.5 mt-2">
            {sheetHeight >= SNAP_FULL ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="text-[11px] text-muted-foreground font-semibold">
              {geofencedLoads.length} load{geofencedLoads.length !== 1 ? 's' : ''}
              {geofenceEnabled ? ` · ≤${GEOFENCE_KM}km` : ' available'}
            </span>
          </div>
        </div>

        <div className="overflow-y-auto px-3 pb-24" style={{ height: `calc(${sheetHeight * 100}vh - 52px)` }}>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : geofencedLoads.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <p className="text-sm font-semibold text-muted-foreground">No loads found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {geofenceEnabled ? `No loads within ${GEOFENCE_KM}km — try disabling the nearby filter` : 'Try adjusting filters or check back soon'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* AI Recommended */}
              {recommendedLoads.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5 px-1">
                    <Flame className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-black text-primary uppercase tracking-wide">AI Recommended</span>
                    <Badge className="text-[9px] h-4 px-1.5 bg-primary/20 text-primary border-primary/30">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Smart
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {recommendedLoads.map((load: any) => (
                      <LoadCard
                        key={`rec-${load.id}`}
                        load={load}
                        onTap={() => handleSelectLoad(load, load.matchScore)}
                        matchScore={load.matchScore}
                        distKm={load.distKm}
                        isRecommended
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All other loads */}
              {otherLoads.length > 0 && (
                <div>
                  <p className="text-[11px] font-black text-muted-foreground mb-2.5 px-1 uppercase tracking-wide">
                    New Trip Requests
                  </p>
                  <div className="space-y-2">
                    {otherLoads.map((load: any) => (
                      <LoadCard
                        key={load.id}
                        load={load}
                        onTap={() => handleSelectLoad(load, load.matchScore)}
                        matchScore={load.matchScore >= 40 ? load.matchScore : undefined}
                        distKm={load.distKm}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <LoadDetailModal
        load={selectedLoad}
        open={!!selectedLoad}
        onClose={() => { setSelectedLoad(null); setSelectedMatchScore(undefined); }}
        matchScore={selectedMatchScore}
      />
    </div>
  );
}
