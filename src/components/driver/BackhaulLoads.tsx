import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, DollarSign, RotateCcw, TrendingUp } from 'lucide-react';

interface BackhaulLoad {
  id: string;
  title: string;
  pickup_location: string;
  delivery_location: string;
  price: number | null;
  equipment_type: string | null;
  created_at: string;
  score: number;
  label: string;
  deadheadKm: number;
}

interface BackhaulLoadsProps {
  deliveryLocation: string;
  originLocation: string;
  forwardPrice: number;
  equipmentType?: string | null;
  onSelectLoad?: (load: any) => void;
}

const geoCache = new Map<string, { lat: number; lng: number }>();
async function geocode(loc: string): Promise<{ lat: number; lng: number } | null> {
  if (geoCache.has(loc)) return geoCache.get(loc)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc + ', Zimbabwe')}&format=json&limit=1`
    );
    const data = await res.json();
    if (data.length > 0) {
      const r = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geoCache.set(loc, r);
      return r;
    }
    return null;
  } catch { return null; }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBackhaulLabel(score: number): string {
  if (score >= 85) return '🎯 Perfect Return Match';
  if (score >= 65) return '🔥 Great Backhaul';
  if (score >= 45) return '📍 Nearby Load';
  return '';
}

export default function BackhaulLoads({ deliveryLocation, originLocation, forwardPrice, equipmentType, onSelectLoad }: BackhaulLoadsProps) {
  const [backhauls, setBackhauls] = useState<BackhaulLoad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deliveryLocation) return;

    const findBackhauls = async () => {
      setLoading(true);

      const [destCoords, originCoords] = await Promise.all([
        geocode(deliveryLocation),
        geocode(originLocation),
      ]);

      if (!destCoords) { setLoading(false); return; }

      // Fetch posted loads
      const { data: loads } = await supabase
        .from('loads')
        .select('*')
        .eq('status', 'posted')
        .limit(100);

      if (!loads?.length) { setBackhauls([]); setLoading(false); return; }

      // Geocode pickup locations of candidate loads
      const scored: BackhaulLoad[] = [];
      for (const load of loads) {
        const pickupCoords = await geocode(load.pickup_location);
        if (!pickupCoords) continue;

        const deadheadKm = haversineKm(destCoords.lat, destCoords.lng, pickupCoords.lat, pickupCoords.lng);

        // Filter: pickup must be within 50km of delivery destination
        if (deadheadKm > 50) continue;

        let score = 0;

        // Deadhead distance (0-30): closer is better
        if (deadheadKm < 10) score += 30;
        else if (deadheadKm < 20) score += 25;
        else if (deadheadKm < 30) score += 18;
        else if (deadheadKm < 40) score += 10;
        else score += 5;

        // Price (0-30)
        const price = load.price || 0;
        if (price >= 1500) score += 30;
        else if (price >= 800) score += 25;
        else if (price >= 400) score += 18;
        else if (price >= 200) score += 10;
        else score += 5;

        // Route direction toward origin (0-20)
        if (originCoords) {
          const loadDeliveryCoords = await geocode(load.delivery_location);
          if (loadDeliveryCoords) {
            const distToOriginFromBackhaul = haversineKm(loadDeliveryCoords.lat, loadDeliveryCoords.lng, originCoords.lat, originCoords.lng);
            const distToOriginFromDest = haversineKm(destCoords.lat, destCoords.lng, originCoords.lat, originCoords.lng);
            if (distToOriginFromBackhaul < distToOriginFromDest * 0.5) score += 20;
            else if (distToOriginFromBackhaul < distToOriginFromDest * 0.8) score += 12;
            else score += 5;
          }
        }

        // Truck compatibility (0-15)
        if (equipmentType && load.equipment_type) {
          if (load.equipment_type.toLowerCase().includes(equipmentType.toLowerCase()) ||
              equipmentType.toLowerCase().includes(load.equipment_type.toLowerCase())) {
            score += 15;
          } else {
            score += 5;
          }
        } else {
          score += 8;
        }

        // Recency (0-5)
        const hoursOld = (Date.now() - new Date(load.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursOld < 6) score += 5;
        else if (hoursOld < 24) score += 3;
        else score += 1;

        score = Math.min(100, score);
        const label = getBackhaulLabel(score);

        if (label) {
          scored.push({
            ...load,
            price: load.price,
            score,
            label,
            deadheadKm: Math.round(deadheadKm),
          });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      setBackhauls(scored.slice(0, 5));
      setLoading(false);
    };

    findBackhauls();
  }, [deliveryLocation, originLocation, equipmentType]);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5 text-primary animate-spin" />
          <span className="text-xs font-medium text-muted-foreground">Finding return loads...</span>
        </div>
      </div>
    );
  }

  if (!backhauls.length) return null;

  const topBackhaul = backhauls[0];
  const totalEarnings = (forwardPrice || 0) + (topBackhaul?.price || 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold">Return Loads</span>
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5">AI</Badge>
        </div>
      </div>

      {/* Total Earnings Summary */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-3 border border-primary/20">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Total Potential Earnings</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-primary">${totalEarnings.toLocaleString()}</span>
          <span className="text-[10px] text-muted-foreground">
            (Forward ${(forwardPrice || 0).toLocaleString()} + Return ${(topBackhaul?.price || 0).toLocaleString()})
          </span>
        </div>
      </div>

      {/* Backhaul cards */}
      <div className="space-y-2">
        {backhauls.map((bh) => (
          <Card key={bh.id} className="overflow-hidden border-border/60 hover:border-primary/30 transition-all cursor-pointer"
            onClick={() => onSelectLoad?.(bh)}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-primary">{bh.label}</span>
                <Badge variant="outline" className="text-[9px]">{bh.deadheadKm} km deadhead</Badge>
              </div>
              <p className="text-xs font-semibold truncate">{bh.title}</p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                <MapPin className="h-2.5 w-2.5" />
                <span className="truncate">{bh.pickup_location} → {bh.delivery_location}</span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-0.5">
                  <DollarSign className="h-3 w-3 text-primary" />
                  <span className="text-sm font-bold text-primary">${Number(bh.price || 0).toLocaleString()}</span>
                </div>
                <Badge className="text-[9px] bg-primary/10 text-primary border-primary/30" variant="outline">
                  {bh.score}% match
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
