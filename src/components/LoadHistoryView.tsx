import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Calendar, DollarSign, CheckCircle, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

export default function LoadHistoryView({ role }: { role: 'shipper' | 'driver' }) {
  const { user } = useAuth();

  const { data: deliveredLoads, isLoading } = useQuery({
    queryKey: ['load-history', role, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('loads')
        .select('*')
        .eq('status', 'delivered')
        .order('completed_at', { ascending: false });

      if (role === 'shipper') {
        query = query.eq('shipper_id', user!.id);
      } else {
        query = query.eq('driver_id', user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!deliveredLoads?.length) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold">No completed loads</h3>
        <p className="mt-1 text-sm text-muted-foreground">Delivered loads will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deliveredLoads.map((load: any, i: number) => (
        <motion.div
          key={load.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className="border-border/50">
            <CardContent className="p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm truncate">{load.title}</h3>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px]">
                      <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Delivered
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{load.pickup_location} → {load.delivery_location}
                    </span>
                    {load.completed_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />{format(new Date(load.completed_at), 'MMM d, yyyy')}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />${Number(load.price).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
