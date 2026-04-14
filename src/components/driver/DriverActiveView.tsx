import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Clock, Package, Phone, CheckCircle, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useState } from 'react';

export default function DriverActiveView() {
  const { user } = useAuth();
  const [completing, setCompleting] = useState<string | null>(null);

  const { data: activeLoads, isLoading } = useQuery({
    queryKey: ['driver-active-loads', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loads')
        .select('*')
        .eq('driver_id', user!.id)
        .in('status', ['accepted', 'in_transit', 'picked_up'])
        .order('accepted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleComplete = async (loadId: string) => {
    setCompleting(loadId);
    try {
      const { error } = await supabase
        .from('loads')
        .update({ status: 'delivered', completed_at: new Date().toISOString() })
        .eq('id', loadId);
      if (error) throw error;
      toast.success('Load marked as delivered!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    } finally {
      setCompleting(null);
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'in_transit': return { label: 'In Transit', class: 'bg-primary/10 text-primary border-primary/20' };
      case 'picked_up': return { label: 'Picked Up', class: 'bg-warning/10 text-warning border-warning/20' };
      default: return { label: 'Accepted', class: 'bg-green-500/10 text-green-500 border-green-500/20' };
    }
  };

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Navigation className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">Active Trips</h2>
        {activeLoads && <Badge variant="secondary" className="text-[10px]">{activeLoads.length}</Badge>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !activeLoads?.length ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="flex flex-col items-center py-14 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Truck className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No active trips</p>
              <p className="text-xs text-muted-foreground mt-1">
                Accept a load from the Home tab to start a trip
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {activeLoads.map((load: any) => {
            const badge = statusBadge(load.status);
            return (
              <motion.div
                key={load.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className={`text-[10px] px-2 py-0.5 border ${badge.class}`}>
                        {badge.label}
                      </Badge>
                      <p className="text-lg font-black text-primary">
                        ${Number(load.price || 0).toLocaleString()}
                      </p>
                    </div>

                    {/* Route */}
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-0.5 pt-1">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                        <div className="w-px h-6 bg-border" />
                        <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
                      </div>
                      <div className="space-y-2 flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{load.pickup_location}</p>
                        <p className="text-sm truncate text-muted-foreground">{load.delivery_location}</p>
                      </div>
                    </div>

                    {/* Info row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {load.equipment_type && (
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" /> {load.equipment_type}
                        </span>
                      )}
                      {load.pickup_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {format(new Date(load.pickup_date), 'MMM d')}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 h-9 text-xs font-bold"
                        onClick={() => handleComplete(load.id)}
                        disabled={completing === load.id}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        {completing === load.id ? 'Updating...' : 'Mark Delivered'}
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 text-xs">
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
