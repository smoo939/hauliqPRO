import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DynamicTileLayer from '@/components/map/DynamicTileLayer';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Navigation, Clock, Timer } from 'lucide-react';

const truckIcon = new L.DivIcon({
  html: `<div style="background:hsl(221,89%,55%);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: '',
});

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

interface DriverPosition {
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

interface LiveTrackingMapProps {
  loadId: string;
  driverId: string;
  pickupLocation: string;
  deliveryLocation: string;
}

export default function LiveTrackingMap({ loadId, driverId, pickupLocation, deliveryLocation }: LiveTrackingMapProps) {
  const [position, setPosition] = useState<DriverPosition | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [eta, setEta] = useState<{ distanceKm: number; minutes: number } | null>(null);

  // Geocode delivery location once
  useEffect(() => {
    if (!deliveryLocation) return;
    // We'll compute ETA when we have both position and delivery coords
  }, [deliveryLocation]);

  // Compute ETA whenever position changes
  useEffect(() => {
    if (!position || !deliveryLocation) return;

    const computeETA = async () => {
      try {
        // Geocode delivery location
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(deliveryLocation)}&limit=1`
        );
        const geoData = await geoRes.json();
        if (!geoData.length) return;

        const destLat = parseFloat(geoData[0].lat);
        const destLng = parseFloat(geoData[0].lon);

        // Get route distance from OSRM
        const routeRes = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${position.lng},${position.lat};${destLng},${destLat}?overview=false`
        );
        const routeData = await routeRes.json();
        if (routeData.code === 'Ok' && routeData.routes?.length) {
          const distanceKm = Math.round(routeData.routes[0].distance / 1000);
          const durationMin = Math.round(routeData.routes[0].duration / 60);

          // Use OSRM duration, or speed-based if speed available
          let etaMinutes = durationMin;
          if (position.speed && position.speed > 1) {
            const speedKmh = position.speed * 3.6;
            etaMinutes = Math.round((distanceKm / speedKmh) * 60);
          }

          setEta({ distanceKm, minutes: etaMinutes });
        }
      } catch {
        // Silently fail ETA calculation
      }
    };

    computeETA();
  }, [position?.lat, position?.lng, deliveryLocation]);

  useEffect(() => {
    const channel = supabase.channel(`tracking:${loadId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'location' }, ({ payload }) => {
      const pos = payload as DriverPosition;
      setPosition(pos);
      setTrail(prev => {
        const next = [...prev, [pos.lat, pos.lng] as [number, number]];
        return next.length > 200 ? next.slice(-200) : next;
      });
      const ago = Math.round((Date.now() - pos.timestamp) / 1000);
      setLastUpdate(ago < 5 ? 'Just now' : `${ago}s ago`);
    });

    channel.subscribe();

    const timer = setInterval(() => {
      if (position) {
        const ago = Math.round((Date.now() - position.timestamp) / 1000);
        if (ago < 60) setLastUpdate(`${ago}s ago`);
        else setLastUpdate(`${Math.round(ago / 60)}m ago`);
      }
    }, 5000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [loadId]);

  const center: [number, number] = position
    ? [position.lat, position.lng]
    : [-19.0154, 29.1549];

  const formatETA = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <span className="text-xs font-medium text-foreground">Live Tracking</span>
        </div>
        <div className="flex items-center gap-1.5">
          {eta && (
            <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/30">
              <Timer className="h-2.5 w-2.5" /> ETA {formatETA(eta.minutes)}
            </Badge>
          )}
          {lastUpdate && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Clock className="h-2.5 w-2.5" /> {lastUpdate}
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 240 }}>
        <MapContainer
          center={center}
          zoom={position ? 13 : 6}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <DynamicTileLayer />
          {position && (
            <>
              <Marker position={[position.lat, position.lng]} icon={truckIcon}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold">Driver Location</p>
                    {position.speed != null && (
                      <p>{Math.round(position.speed * 3.6)} km/h</p>
                    )}
                    {eta && <p>ETA: {formatETA(eta.minutes)} ({eta.distanceKm} km left)</p>}
                  </div>
                </Popup>
              </Marker>
              <RecenterMap lat={position.lat} lng={position.lng} />
            </>
          )}
          {trail.length > 1 && (
            <Polyline
              positions={trail}
              pathOptions={{ color: 'hsl(221, 89%, 55%)', weight: 3, opacity: 0.6, dashArray: '8 4' }}
            />
          )}
        </MapContainer>
      </div>

      {!position && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Waiting for driver's GPS signal...
        </div>
      )}

      {position && (
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
            <Navigation className="h-3.5 w-3.5 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground">Coordinates</p>
              <p className="text-xs font-medium">{position.lat.toFixed(4)}, {position.lng.toFixed(4)}</p>
            </div>
          </div>
          {position.speed != null && (
            <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <div>
                <p className="text-[10px] text-muted-foreground">Speed</p>
                <p className="text-xs font-medium">{Math.round(position.speed * 3.6)} km/h</p>
              </div>
            </div>
          )}
          {eta && (
            <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5">
              <Timer className="h-3.5 w-3.5 text-primary" />
              <div>
                <p className="text-[10px] text-muted-foreground">Remaining</p>
                <p className="text-xs font-medium">{eta.distanceKm} km</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
