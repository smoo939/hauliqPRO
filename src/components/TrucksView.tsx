import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, Star, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TrucksView({ role }: { role: 'shipper' | 'driver' }) {
  const { user } = useAuth();

  // For shippers: show drivers who have bid on their loads
  // For drivers: show their own truck / profile info
  const { data: drivers, isLoading } = useQuery({
    queryKey: ['trucks-view', role, user?.id],
    queryFn: async () => {
      if (role === 'driver') {
        // Show own profile as truck
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user!.id)
          .single();
        return data ? [data] : [];
      }
      // Shipper: show active drivers from bids
      const { data: bids } = await supabase
        .from('bids')
        .select('driver_id')
        .limit(20);
      if (!bids?.length) return [];
      const driverIds = [...new Set(bids.map((b: any) => b.driver_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', driverIds);
      return profiles || [];
    },
    enabled: !!user,
  });

  // Get reviews for each driver
  const driverIds = drivers?.map((d: any) => d.user_id) || [];
  const { data: reviews } = useQuery({
    queryKey: ['driver-reviews', driverIds],
    queryFn: async () => {
      if (!driverIds.length) return {};
      const { data } = await supabase
        .from('reviews')
        .select('reviewed_id, rating')
        .in('reviewed_id', driverIds);
      const map: Record<string, { total: number; count: number }> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.reviewed_id]) map[r.reviewed_id] = { total: 0, count: 0 };
        map[r.reviewed_id].total += r.rating;
        map[r.reviewed_id].count += 1;
      });
      return map;
    },
    enabled: driverIds.length > 0,
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">
        {role === 'driver' ? 'My Truck' : 'Available Carriers'}
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !drivers?.length ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Truck className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {role === 'driver' ? 'Complete your profile to list your truck' : 'No carriers found yet'}
          </p>
        </div>
      ) : (
        drivers.map((driver: any, i: number) => {
          const review = reviews?.[driver.user_id];
          const avgRating = review ? (review.total / review.count).toFixed(1) : null;
          return (
            <motion.div
              key={driver.user_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{driver.full_name || 'Carrier'}</p>
                        {driver.verified && (
                          <Badge variant="outline" className="text-xs text-success border-success/30">Verified</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {driver.phone && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {driver.phone}
                          </span>
                        )}
                        {avgRating && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-warning" /> {avgRating}
                            <span className="text-muted-foreground">({review!.count})</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Joined {new Date(driver.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })
      )}
    </div>
  );
}
