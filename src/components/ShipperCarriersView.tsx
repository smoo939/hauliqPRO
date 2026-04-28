import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Search, SlidersHorizontal, ShieldCheck, Truck, MapPin, Star } from 'lucide-react';

const TRUCK_TYPES = [
  'Flatbed', 'Enclosed', 'Refrigerated', 'Tanker', 'Lowbed', 'Tipper',
  'Curtain-side', 'Container', 'Car Carrier', 'Livestock', 'Logging', 'Side Loader',
];

interface CarrierRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  verified: boolean | null;
  city: string | null;
  truck_label: string | null;
  registration_number: string | null;
  overall_status: string | null;
  rating: number | null;
  trips_completed: number | null;
  lat: number | null;
  lng: number | null;
}

const geoCache = new Map<string, { lat: number; lng: number } | null>();
async function geocode(location: string): Promise<{ lat: number; lng: number } | null> {
  if (!location) return null;
  if (geoCache.has(location)) return geoCache.get(location)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location + ', Zimbabwe')}&format=json&limit=1`
    );
    const data = await res.json();
    const result = data?.[0]
      ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      : null;
    geoCache.set(location, result);
    return result;
  } catch {
    return null;
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ShipperCarriersView() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [truckTypes, setTruckTypes] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState(0); // 0 = no radius filter
  const [shipperPos, setShipperPos] = useState<{ lat: number; lng: number } | null>(null);
  const [carriers, setCarriers] = useState<CarrierRow[]>([]);

  // Get shipper's current location for radius filter
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setShipperPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 5000, maximumAge: 60000 }
    );
  }, []);

  // Load all carriers (drivers) with their truck verifications
  const { data: rawCarriers, isLoading } = useQuery({
    queryKey: ['browse-carriers'],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver');
      const driverIds = (profiles || []).map((p: any) => p.user_id);
      const trucks: any[] = [];
      for (const id of driverIds) {
        const { data: t } = await supabase
          .from('truck_verifications')
          .select('*')
          .eq('user_id', id)
          .limit(1)
          .maybeSingle();
        trucks.push(t);
      }
      const reviews: Record<string, { count: number; total: number }> = {};
      for (const id of driverIds) {
        const { data: rs } = await supabase
          .from('reviews')
          .select('rating')
          .eq('reviewed_id', id);
        const list = rs || [];
        reviews[id] = {
          count: list.length,
          total: list.reduce((s: number, r: any) => s + Number(r.rating || 0), 0),
        };
      }
      const completedTrips: Record<string, number> = {};
      for (const id of driverIds) {
        const { data: ls } = await supabase
          .from('loads')
          .select('id')
          .eq('driver_id', id)
          .eq('status', 'delivered');
        completedTrips[id] = (ls || []).length;
      }

      return (profiles || []).map((p: any, idx: number): CarrierRow => {
        const t = trucks[idx];
        const r = reviews[p.user_id];
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          verified: p.verified,
          city: p.city || null,
          truck_label: t?.truck_label || null,
          registration_number: t?.registration_number || null,
          overall_status: t?.overall_status || null,
          rating: r && r.count > 0 ? Number((r.total / r.count).toFixed(1)) : null,
          trips_completed: completedTrips[p.user_id] || 0,
          lat: null,
          lng: null,
        };
      });
    },
  });

  // Geocode each carrier's city (sequentially with throttling for Nominatim politeness)
  useEffect(() => {
    if (!rawCarriers) return;
    let cancelled = false;
    (async () => {
      const enriched: CarrierRow[] = [];
      for (const c of rawCarriers) {
        if (cancelled) return;
        if (c.city) {
          const coords = await geocode(c.city);
          enriched.push({ ...c, lat: coords?.lat ?? null, lng: coords?.lng ?? null });
          await new Promise((r) => setTimeout(r, 1100));
        } else {
          enriched.push(c);
        }
      }
      if (!cancelled) setCarriers(enriched);
    })();
    return () => { cancelled = true; };
  }, [rawCarriers]);

  const filtered = useMemo(() => {
    return (carriers.length ? carriers : rawCarriers || []).filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        const ok =
          c.full_name?.toLowerCase().includes(q) ||
          c.truck_label?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.registration_number?.toLowerCase().includes(q);
        if (!ok) return false;
      }
      if (truckTypes.length) {
        const label = c.truck_label?.toLowerCase() || '';
        if (!truckTypes.some((t) => label.includes(t.toLowerCase()))) return false;
      }
      if (verifiedOnly) {
        const isVerified = c.verified === true || c.overall_status === 'verified' || c.overall_status === 'approved';
        if (!isVerified) return false;
      }
      if (radiusKm > 0 && shipperPos && c.lat != null && c.lng != null) {
        const d = haversineKm(shipperPos.lat, shipperPos.lng, c.lat, c.lng);
        if (d > radiusKm) return false;
      }
      return true;
    });
  }, [carriers, rawCarriers, search, truckTypes, verifiedOnly, radiusKm, shipperPos]);

  const activeFilterCount =
    (truckTypes.length > 0 ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (radiusKm > 0 ? 1 : 0);

  const toggleTruck = (t: string) =>
    setTruckTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div className="space-y-3">
      {/* Search + filter button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-card rounded-full shadow-soft px-4 h-10 border border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search carriers, trucks, cities…"
            className="border-0 bg-transparent h-8 px-0 text-xs focus-visible:ring-0"
          />
        </div>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full h-10 gap-1 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl">
            <SheetHeader>
              <div className="flex items-center justify-between">
                <SheetTitle className="text-base">Filter Carriers</SheetTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => { setTruckTypes([]); setVerifiedOnly(false); setRadiusKm(0); }}
                >Reset all</Button>
              </div>
            </SheetHeader>

            <div className="mt-4 space-y-6 overflow-y-auto pb-20">
              <div>
                <p className="text-sm font-medium mb-2">Truck Type</p>
                <div className="flex flex-wrap gap-1.5">
                  {TRUCK_TYPES.map((t) => (
                    <Badge
                      key={t}
                      variant={truckTypes.includes(t) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleTruck(t)}
                    >{t}</Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-input p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Verified only</p>
                    <p className="text-xs text-muted-foreground">Show carriers with verified docs</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">
                  Distance Radius: {radiusKm === 0 ? 'Any' : `${radiusKm} km`}
                </p>
                <Slider value={[radiusKm]} onValueChange={([v]) => setRadiusKm(v)} max={500} step={10} />
                {!shipperPos && radiusKm > 0 && (
                  <p className="text-[10px] text-warning mt-1">Allow location access to use distance radius.</p>
                )}
              </div>

              <Button className="w-full" onClick={() => setFiltersOpen(false)}>Apply Filters</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {truckTypes.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px] cursor-pointer" onClick={() => toggleTruck(t)}>{t} ×</Badge>
          ))}
          {verifiedOnly && (
            <Badge variant="secondary" className="text-[10px] cursor-pointer" onClick={() => setVerifiedOnly(false)}>Verified ×</Badge>
          )}
          {radiusKm > 0 && (
            <Badge variant="secondary" className="text-[10px] cursor-pointer" onClick={() => setRadiusKm(0)}>≤{radiusKm}km ×</Badge>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-2">
              <Truck className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">No carriers match</p>
            <p className="text-xs text-muted-foreground mt-1">Try widening your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const isVerified = c.verified === true || c.overall_status === 'verified' || c.overall_status === 'approved';
            const distKm = shipperPos && c.lat != null && c.lng != null
              ? Math.round(haversineKm(shipperPos.lat, shipperPos.lng, c.lat, c.lng))
              : null;
            return (
              <Card key={c.user_id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0 overflow-hidden">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-primary">
                          {(c.full_name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold truncate">{c.full_name || 'Carrier'}</p>
                        {isVerified && (
                          <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Verified" />
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        {c.truck_label && (
                          <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />{c.truck_label}</span>
                        )}
                        {c.city && (
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}{distKm != null ? ` · ${distKm}km` : ''}</span>
                        )}
                        {c.rating != null && (
                          <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" />{c.rating}</span>
                        )}
                        <span className="inline-flex items-center gap-1">{c.trips_completed ?? 0} trips</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
