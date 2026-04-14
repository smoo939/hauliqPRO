import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, CheckCircle, Package, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import LoadChat from '@/components/LoadChat';
import { BidForm } from '@/components/BidSystem';
import { AIDynamicPricing } from '@/components/AILoadInsights';
import StatusMilestones from '@/components/StatusMilestones';
import LoadFilters, { applyLoadFilters, defaultFilters, type LoadFilterValues } from '@/components/LoadFilters';
import { useDriverTracking } from '@/hooks/useDriverTracking';
import { useLocalFirstSnapshot } from '@/lib/localFirst';

const statusConfig: Record<string, { label: string; color: string }> = {
  posted: { label: 'Available', color: 'bg-primary/10 text-primary border-primary/30' },
  accepted: { label: 'Dispatched', color: 'bg-primary/10 text-primary border-primary/30' },
  in_transit: { label: 'In Transit', color: 'bg-warning/10 text-warning border-warning/30' },
  delivered: { label: 'Delivered', color: 'bg-success/10 text-success border-success/30' },
};

export default function DriverLoadsView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { online, loads: localLoads } = useLocalFirstSnapshot();
  const [activeTab, setActiveTab] = useState<'available' | 'my-loads'>('available');
  const [chatLoadId, setChatLoadId] = useState<string | null>(null);
  const [filters, setFilters] = useState<LoadFilterValues>(defaultFilters);

  const availableLoads = useMemo(() => localLoads.filter((load: any) => load.status === 'posted'), [localLoads]);
  const myLoads = useMemo(() => localLoads.filter((load: any) => load.driver_id === user?.id), [localLoads, user?.id]);
  const myLoadsForTracking = myLoads;

  const activeTransitLoadId = useMemo(
    () => myLoadsForTracking?.find((l: any) => l.status === 'in_transit')?.id ?? null,
    [myLoadsForTracking]
  );
  useDriverTracking(activeTransitLoadId);

  const updateStatus = useMutation({
    mutationFn: async ({ loadId, status }: { loadId: string; status: string }) => {
      const updates: any = { status };
      if (status === 'delivered') updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from('loads').update(updates).eq('id', loadId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['driver-loads'] }); toast.success('Status updated!'); },
    onError: (err: any) => toast.error(err.message),
  });

  const isLoading = !!user && online && localLoads.length === 0;
  const rawLoads = activeTab === 'available' ? availableLoads : myLoads?.filter((l: any) => l.status !== 'delivered');
  const displayLoads = activeTab === 'available' ? applyLoadFilters(rawLoads || [], filters) : rawLoads;

  return (
    <>
      <div className="flex gap-1 rounded-lg bg-muted p-1 mb-4">
        <button onClick={() => setActiveTab('available')} className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${activeTab === 'available' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
          Available
        </button>
        <button onClick={() => setActiveTab('my-loads')} className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${activeTab === 'my-loads' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
          My Loads
        </button>
      </div>

      {activeTab === 'available' && <LoadFilters filters={filters} onChange={setFilters} />}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : !displayLoads?.length ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted"><Package className="h-8 w-8 text-muted-foreground" /></div>
          <h3 className="text-lg font-semibold">{activeTab === 'available' ? 'No loads available' : 'No active loads'}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{activeTab === 'available' ? 'Check back soon' : 'Bid on loads to get started'}</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {displayLoads.map((load: any, i: number) => {
              const config = statusConfig[load.status] || statusConfig.posted;
              return (
                <motion.div key={load.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.06 }}>
                  <Card className="overflow-hidden border-border/60 hover:border-primary/30 transition-all">
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between px-4 pt-3 pb-2">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[10px] uppercase tracking-wide font-semibold ${config.color}`}>
                            {config.label}
                          </Badge>
                          {(load as any).urgent && (
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
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-t border-border/40 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground truncate">{load.title}</span>
                        <span className="ml-auto shrink-0">{load.pickup_date ? format(new Date(load.pickup_date), 'MMM d') : ''}</span>
                      </div>
                      {activeTab === 'my-loads' && ['accepted', 'in_transit'].includes(load.status) && (
                        <div className="px-4 py-3 border-t border-border/40"><StatusMilestones currentStatus={load.status} /></div>
                      )}
                      {activeTab === 'available' && load.status === 'posted' && (
                        <div className="px-4 py-3 border-t border-border/40"><AIDynamicPricing load={load} /></div>
                      )}
                      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/40">
                        {activeTab === 'available' && load.status === 'posted' && <BidForm loadId={load.id} />}
                        {activeTab === 'my-loads' && load.status === 'accepted' && (
                          <Button size="sm" onClick={() => updateStatus.mutate({ loadId: load.id, status: 'in_transit' })}>
                            <Truck className="mr-1.5 h-3.5 w-3.5" /> Start Transit
                          </Button>
                        )}
                        {activeTab === 'my-loads' && load.status === 'in_transit' && (
                          <Button size="sm" onClick={() => updateStatus.mutate({ loadId: load.id, status: 'delivered' })}>
                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Delivered
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => setChatLoadId(chatLoadId === load.id ? null : load.id)}>
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                      {chatLoadId === load.id && (
                        <div className="px-4 py-3 border-t border-border/40"><LoadChat loadId={load.id} /></div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
