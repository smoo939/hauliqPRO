import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, Marker, Popup } from 'react-leaflet';
import DynamicTileLayer from '@/components/map/DynamicTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DollarSign, MapPin } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface GeoLoad {
  id: string;
  title: string;
  pickup_location: string;
  delivery_location: string;
  price: number;
  status: string;
  lat: number;
  lng: number;
}

async function geocode(location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location + ', Zimbabwe')}&format=json&limit=1`
    );
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    return null;
  } catch {
    return null;
  }
}

export default function LoadMapView({ role }: { role: 'shipper' | 'driver' }) {
  const { user } = useAuth();
  const [geoLoads, setGeoLoads] = useState<GeoLoad[]>([]);

  const { data: loads } = useQuery({
    queryKey: ['map-loads', role, user?.id],
    queryFn: async () => {
      let query = supabase.from('loads').select('*').order('created_at', { ascending: false }).limit(20);
      if (role === 'shipper') query = query.eq('shipper_id', user!.id);
      else query = query.eq('status', 'posted');
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!loads?.length) return;
    const geocodeAll = async () => {
      const results: GeoLoad[] = [];
      // Geocode in batches of 3 to respect Nominatim rate limits
      for (let i = 0; i < loads.length; i += 3) {
        const batch = loads.slice(i, i + 3);
        const geos = await Promise.all(
          batch.map(async (load: any) => {
            const coords = await geocode(load.pickup_location);
            if (coords) {
              return { ...load, lat: coords.lat, lng: coords.lng } as GeoLoad;
            }
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

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Load Map</h2>
      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 400 }}>
        <MapContainer
          center={[-19.0154, 29.1549]}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <DynamicTileLayer />
          {geoLoads.map((load) => (
            <Marker key={load.id} position={[load.lat, load.lng]}>
              <Popup>
                <div className="min-w-[160px]">
                  <p className="font-semibold text-sm">{load.title}</p>
                  <div className="flex items-center gap-1 text-xs mt-1">
                    <MapPin className="h-3 w-3" />
                    {load.pickup_location} → {load.delivery_location}
                  </div>
                  <div className="flex items-center gap-1 text-xs mt-0.5">
                    <DollarSign className="h-3 w-3" />${Number(load.price).toFixed(0)}
                  </div>
                  <Badge variant="outline" className="mt-1 text-[10px]">{load.status}</Badge>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">{geoLoads.length} loads plotted</p>
    </div>
  );
}
