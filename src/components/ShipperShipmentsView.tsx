import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, Package } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import LoadChat from '@/components/LoadChat';
import { BidList } from '@/components/BidSystem';
import { AICarrierMatch, AIDynamicPricing } from '@/components/AILoadInsights';
import StatusMilestones from '@/components/StatusMilestones';
import LiveTrackingMap from '@/components/LiveTrackingMap';

const statusColors: Record<string, string> = {
  posted: 'bg-primary/10 text-primary border-primary/30',
  accepted: 'bg-primary/10 text-primary border-primary/30',
  in_transit: 'bg-warning/10 text-warning border-warning/30',
  delivered: 'bg-success/10 text-success border-success/30',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
};

export default function ShipperShipmentsView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chatLoadId, setChatLoadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  const { data: loads, isLoading } = useQuery({
    queryKey: ['shipper-loads', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loads').select('*').eq('shipper_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const acceptBid = useMutation({
    mutationFn: async ({ bidId, driverId, amount, loadId }: { bidId: string; driverId: string; amount: number; loadId: string }) => {
      const { error: bidError } = await supabase.from('bids').update({ status: 'accepted' }).eq('id', bidId);
      if (bidError) throw bidError;
      await supabase.from('bids').update({ status: 'rejected' }).eq('load_id', loadId).neq('id', bidId).eq('status', 'pending');
      const platformFee = amount * 0.1;
      const { error: loadError } = await supabase.from('loads').update({
        driver_id: driverId, status: 'accepted', price: amount, platform_fee: platformFee,
        accepted_at: new Date().toISOString(),
      }).eq('id', loadId);
      if (loadError) throw loadError;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shipper-loads'] }); toast.success('Bid accepted!'); },
    onError: (err: any) => toast.error(err.message),
  });

  const displayLoads = activeTab === 'active'
    ? loads?.filter((l: any) => l.status !== 'delivered')
    : loads?.filter((l: any) => l.status === 'delivered');

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">My Shipments</h2>

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button onClick={() => setActiveTab('active')} className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${activeTab === 'active' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
          Active
        </button>
        <button onClick={() => setActiveTab('completed')} className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${activeTab === 'completed' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
          Completed
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : !displayLoads?.length ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><Package className="h-7 w-7 text-muted-foreground" /></div>
          <h3 className="text-base font-semibold">{activeTab === 'active' ? 'No active shipments' : 'No completed shipments'}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{activeTab === 'active' ? 'Create a load to get started' : 'Completed loads will appear here'}</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {displayLoads.map((load: any, i: number) => (
              <motion.div key={load.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.06 }}>
                <Card className="overflow-hidden border-border/60 hover:border-primary/30 transition-all">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[10px] uppercase tracking-wide font-semibold ${statusColors[load.status] || ''}`}>
                          {load.status.replace('_', ' ')}
                        </Badge>
                        {load.urgent && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide font-semibold bg-destructive/10 text-destructive border-destructive/30">
                            🚨 Urgent
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-bold text-foreground">${Number(load.price).toFixed(0)}</span>
                    </div>

                    <div className="px-4 pb-3">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-0.5 pt-1">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <div className="w-px h-6 bg-border" />
                          <div className="h-2 w-2 rounded-full border-2 border-primary" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div><p className="text-xs text-muted-foreground">Pickup</p><p className="text-sm font-medium truncate">{load.pickup_location}</p></div>
                          <div><p className="text-xs text-muted-foreground">Delivery</p><p className="text-sm font-medium truncate">{load.delivery_location}</p></div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setChatLoadId(chatLoadId === load.id ? null : load.id)}>
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-t border-border/40 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground truncate">{load.title}</span>
                      <span className="ml-auto shrink-0">{load.pickup_date ? format(new Date(load.pickup_date), 'MMM d') : ''}</span>
                      {load.equipment_type && <span>· {load.equipment_type}</span>}
                    </div>

                    {/* Tracking map embedded in shipment card */}
                    {['accepted', 'in_transit'].includes(load.status) && (
                      <div className="px-4 py-3 border-t border-border/40 space-y-3">
                        <StatusMilestones currentStatus={load.status} />
                        {load.status === 'in_transit' && load.driver_id && (
                          <LiveTrackingMap
                            loadId={load.id}
                            driverId={load.driver_id}
                            pickupLocation={load.pickup_location}
                            deliveryLocation={load.delivery_location}
                          />
                        )}
                      </div>
                    )}

                    {load.status === 'posted' && (
                      <div className="px-4 py-3 border-t border-border/40 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <AICarrierMatch load={load} />
                          <AIDynamicPricing load={load} />
                        </div>
                        <BidList loadId={load.id} onAcceptBid={(bidId, driverId, amount) => acceptBid.mutate({ bidId, driverId, amount, loadId: load.id })} />
                      </div>
                    )}

                    {chatLoadId === load.id && (
                      <div className="px-4 py-3 border-t border-border/40"><LoadChat loadId={load.id} /></div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
