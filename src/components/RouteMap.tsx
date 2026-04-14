import { useEffect, useState, useRef } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Navigation, DollarSign } from 'lucide-react';
import DynamicTileLayer from '@/components/map/DynamicTileLayer';
import { getORSRoute } from '@/hooks/useMapTiles';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pickupIcon = new L.DivIcon({
  html: `<div style="background:hsl(221,89%,55%);width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(37,99,235,0.4);"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="5"/></svg></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  className: '',
});

const deliveryIcon = new L.DivIcon({
  html: `<div style="background:hsl(152,69%,40%);width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(34,197,94,0.4);"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  className: '',
});

interface RouteInfo {
  distanceKm: number;
  durationHours: number;
  suggestedPrice: number;
  routeCoords: [number, number][];
}

interface Coords {
  lat: number;
  lng: number;
}

// Zimbabwe-centric rate: ~$2.50/km for trucking
const RATE_PER_KM = 2.5;

async function geocodeLocation(location: string): Promise<Coords | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location + ', Zimbabwe')}&format=json&limit=1`
    );
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

async function getRoute(from: Coords, to: Coords): Promise<RouteInfo | null> {
  // Try ORS first (HGV profile)
  const orsResult = await getORSRoute(from.lng, from.lat, to.lng, to.lat);
  if (orsResult) {
    return {
      distanceKm: orsResult.distanceKm,
      durationHours: orsResult.durationHours,
      suggestedPrice: Math.round(orsResult.distanceKm * RATE_PER_KM),
      routeCoords: orsResult.coords,
    };
  }
  // Fallback to OSRM
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    if (data.routes?.length > 0) {
      const route = data.routes[0];
      const distanceKm = Math.round(route.distance / 1000);
      const durationHours = Math.round((route.duration / 3600) * 10) / 10;
      return {
        distanceKm,
        durationHours,
        suggestedPrice: Math.round(distanceKm * RATE_PER_KM),
        routeCoords: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]),
      };
    }
    return null;
  } catch { return null; }
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length >= 2) {
      const bounds = L.latLngBounds(coords.map(c => L.latLng(c[0], c[1])));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [coords, map]);
  return null;
}

interface RouteMapProps {
  pickup: string;
  delivery: string;
  onRouteCalculated?: (info: RouteInfo) => void;
  className?: string;
}

export default function RouteMap({ pickup, delivery, onRouteCalculated, className = '' }: RouteMapProps) {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const lastQuery = useRef('');

  useEffect(() => {
    const query = `${pickup}|${delivery}`;
    if (!pickup || !delivery || query === lastQuery.current) return;
    lastQuery.current = query;

    const calculate = async () => {
      setLoading(true);
      setError('');
      const [pCoords, dCoords] = await Promise.all([
        geocodeLocation(pickup),
        geocodeLocation(delivery),
      ]);

      if (!pCoords || !dCoords) {
        setError('Could not find one or both locations');
        setLoading(false);
        return;
      }

      setPickupCoords(pCoords);
      setDeliveryCoords(dCoords);

      const route = await getRoute(pCoords, dCoords);
      if (route) {
        setRouteInfo(route);
        onRouteCalculated?.(route);
      } else {
        setError('Could not calculate route');
      }
      setLoading(false);
    };

    const debounce = setTimeout(calculate, 800);
    return () => clearTimeout(debounce);
  }, [pickup, delivery, onRouteCalculated]);

  // Default center on Zimbabwe
  const center: [number, number] = pickupCoords
    ? [pickupCoords.lat, pickupCoords.lng]
    : [-19.0154, 29.1549];

  return (
    <div className={className}>
      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 220 }}>
        <MapContainer
          center={center}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <DynamicTileLayer />
          {pickupCoords && (
            <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon}>
              <Popup>{pickup}</Popup>
            </Marker>
          )}
          {deliveryCoords && (
            <Marker position={[deliveryCoords.lat, deliveryCoords.lng]} icon={deliveryIcon}>
              <Popup>{delivery}</Popup>
            </Marker>
          )}
          {routeInfo && routeInfo.routeCoords.length > 0 && (
            <>
              <Polyline
                positions={routeInfo.routeCoords}
                pathOptions={{ color: 'hsl(221, 89%, 55%)', weight: 6, opacity: 0.85 }}
              />
              <FitBounds coords={routeInfo.routeCoords} />
            </>
          )}
        </MapContainer>
      </div>

      {loading && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Calculating route...
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {routeInfo && !loading && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
            <Navigation className="h-3.5 w-3.5 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground">Distance</p>
              <p className="text-sm font-semibold">{routeInfo.distanceKm} km</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground">Duration</p>
              <p className="text-sm font-semibold">{routeInfo.durationHours}h</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground">Fair Price</p>
              <p className="text-sm font-semibold">${routeInfo.suggestedPrice}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { RouteInfo };
