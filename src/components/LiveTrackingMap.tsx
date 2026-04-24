import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DynamicTileLayer from '@/components/map/DynamicTileLayer';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, Clock, Timer } from 'lucide-react';

const truckIcon = new L.DivIcon({
  html: `<div style="background:#FBBF24;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #ffffff;box-shadow:0 6px 18px rgba(251,191,36,0.55), 0 2px 8px rgba(0,0,0,0.18);">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D3436" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
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

  useEffect(() => {
    if (!position || !deliveryLocation) return;
    const computeETA = async () => {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(deliveryLocation)}&limit=1`
        );
        const geoData = await geoRes.json();
        if (!geoData.length) return;
        const destLat = parseFloat(geoData[0].lat);
        const destLng = parseFloat(geoData[0].lon);
        const routeRes = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${position.lng},${position.lat};${destLng},${destLat}?overview=false`
        );
        const routeData = await routeRes.json();
        if (routeData.code === 'Ok' && routeData.routes?.length) {
          const distanceKm = Math.round(routeData.routes[0].distance / 1000);
          const durationMin = Math.round(routeData.routes[0].duration / 60);
          let etaMinutes = durationMin;
          if (position.speed && position.speed > 1) {
            const speedKmh = position.speed * 3.6;
            etaMinutes = Math.round((distanceKm / speedKmh) * 60);
          }
          setEta({ distanceKm, minutes: etaMinutes });
        }
      } catch {
        /* silent */
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
    <div className="relative rounded-xl overflow-hidden shadow-soft" style={{ height: 280 }}>
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
                  {position.speed != null && <p>{Math.round(position.speed * 3.6)} km/h</p>}
                  {eta && <p>ETA: {formatETA(eta.minutes)} ({eta.distanceKm} km left)</p>}
                </div>
              </Popup>
            </Marker>
            <RecenterMap lat={position.lat} lng={position.lng} />
          </>
        )}
        {trail.length > 1 && (
          <>
            {/* glowing amber halo */}
            <Polyline
              positions={trail}
              pathOptions={{ color: '#FBBF24', weight: 12, opacity: 0.18, lineCap: 'round' }}
            />
            <Polyline
              positions={trail}
              pathOptions={{ color: '#FBBF24', weight: 6, opacity: 0.35, lineCap: 'round' }}
            />
            {/* bright core */}
            <Polyline
              positions={trail}
              pathOptions={{ color: '#FBBF24', weight: 3.2, opacity: 1, lineCap: 'round' }}
            />
          </>
        )}
      </MapContainer>

      {/* Live indicator pill — top-left */}
      <div className="absolute top-3 left-3 z-[400] glass shadow-soft rounded-full px-2.5 py-1 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-[10.5px] font-semibold tracking-tight text-foreground">LIVE</span>
      </div>

      {/* Last update — top-right */}
      {lastUpdate && (
        <div className="absolute top-3 right-3 z-[400] glass shadow-soft rounded-full px-2.5 py-1 flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10.5px] font-medium text-foreground">{lastUpdate}</span>
        </div>
      )}

      {/* Inset floating tracking card — bottom */}
      {position && (
        <div className="absolute bottom-3 left-3 right-3 z-[400] glass shadow-float rounded-2xl p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary shrink-0 glow-amber">
              <Navigation className="h-[18px] w-[18px] text-primary-foreground" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] heavy-label">Driver in transit</p>
              <p className="text-sm font-bold tracking-tight truncate text-foreground">
                {eta ? `Arriving in ${formatETA(eta.minutes)}` : 'Calculating ETA…'}
              </p>
            </div>
            {position.speed != null && (
              <div className="text-right shrink-0 pl-2">
                <p className="text-[10.5px] heavy-label">Speed</p>
                <p className="text-sm font-bold text-foreground">{Math.round(position.speed * 3.6)} <span className="text-[10px] font-medium text-muted-foreground">km/h</span></p>
              </div>
            )}
            {eta && (
              <div className="text-right shrink-0 pl-2">
                <p className="text-[10.5px] heavy-label">Distance</p>
                <p className="text-sm font-bold text-foreground">{eta.distanceKm} <span className="text-[10px] font-medium text-muted-foreground">km</span></p>
              </div>
            )}
          </div>
        </div>
      )}

      {!position && (
        <div className="absolute bottom-3 left-3 right-3 z-[400] glass shadow-soft rounded-2xl px-3 py-2.5 flex items-center gap-2">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs font-medium text-foreground">Waiting for driver's GPS signal…</span>
          <Timer className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
        </div>
      )}
    </div>
  );
}
