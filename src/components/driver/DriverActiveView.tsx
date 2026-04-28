import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDriverTracking } from '@/hooks/useDriverTracking';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Navigation, Clock, Package, Phone, CheckCircle, Truck, XCircle, DollarSign, Star } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const CANCEL_REASONS = [
  'Unable to complete route',
  'Truck breakdown',
  'Cargo handling issue',
  'Shipper not available',
  'Route conditions unsafe',
  'Personal emergency',
  'Other',
];

export default function DriverActiveView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState<string | null>(null);
  const [cancelLoadId, setCancelLoadId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelCustom, setCancelCustom] = useState('');

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
      queryClient.invalidateQueries({ queryKey: ['driver-active-loads'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    } finally {
      setCompleting(null);
    }
  };

  const cancelLoad = useMutation({
    mutationFn: async ({ loadId, reason }: { loadId: string; reason: string }) => {
      const { error } = await supabase.from('loads').update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_by: 'driver',
        driver_id: null,
      }).eq('id', loadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-active-loads'] });
      toast.success('Load cancelled. The shipper has been notified.');
      setCancelLoadId(null);
      setCancelReason('');
      setCancelCustom('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusBadge = (s: string) => {
    switch (s) {
      case 'in_transit': return { label: 'In Transit', class: 'bg-warning/10 text-warning border-warning/20' };
      case 'picked_up': return { label: 'Picked Up', class: 'bg-primary/10 text-primary border-primary/20' };
      default: return { label: 'Accepted', class: 'bg-success/10 text-success border-success/20' };
    }
  };

  const { data: stats } = useQuery({
    queryKey: ['driver-stats', user?.id],
    queryFn: async () => {
      const [earningsRes, reviewsRes] = await Promise.all([
        supabase.from('loads').select('price').eq('driver_id', user!.id).eq('status', 'delivered'),
        supabase.from('reviews').select('rating').eq('reviewed_id', user!.id),
      ]);
      const loads = earningsRes.data || [];
      const reviews = reviewsRes.data || [];
      const totalEarnings = loads.reduce((sum: number, l: any) => sum + Number(l.price || 0), 0);
      const avgRating = reviews.length
        ? (reviews.reduce((s: number, r: any) => s + Number(r.rating), 0) / reviews.length).toFixed(1)
        : '—';
      return { totalEarnings, tripsCompleted: loads.length, avgRating };
    },
    enabled: !!user,
  });

  const finalCancelReason = cancelReason === 'Other' ? cancelCustom : cancelReason;

  // Live GPS tracking — publish for the most recent active in-transit / picked-up load
  const trackingLoad = activeLoads?.find((l: any) => ['in_transit', 'picked_up', 'accepted'].includes(l.status));
  useDriverTracking(trackingLoad?.id ?? null, user?.id ?? null);

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      {/* Stats strip — matches mockup design */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bento-card p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <DollarSign className="h-3 w-3" />
          </div>
          <p className="text-base font-black text-primary leading-none">${(stats?.totalEarnings || 0).toLocaleString()}</p>
          <p className="heavy-label mt-1">Earned</p>
        </div>
        <div className="bento-card p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <Truck className="h-3 w-3" />
          </div>
          <p className="text-base font-black leading-none">{stats?.tripsCompleted ?? '—'}</p>
          <p className="heavy-label mt-1">Completed</p>
        </div>
        <div className="bento-card p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <Star className="h-3 w-3" />
          </div>
          <p className="text-base font-black leading-none text-primary">{stats?.avgRating ?? '—'}</p>
          <p className="heavy-label mt-1">Rating</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Navigation className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-black uppercase tracking-wide">Active Trips</h2>
        {activeLoads && activeLoads.length > 0 && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">{activeLoads.length}</Badge>}
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
              <p className="text-sm font-semibold">No active trips</p>
              <p className="text-xs text-muted-foreground mt-1">
                Win a bid from the Home tab to get started
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
                <Card className="overflow-hidden industrial-border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className={`text-[10px] px-2 py-0.5 border font-bold ${badge.class}`}>
                        {badge.label}
                      </Badge>
                      <p className="text-xl font-black text-primary">
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
                        <p className="text-sm font-semibold truncate">{load.pickup_location}</p>
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
                        className="flex-1 h-9 text-xs font-bold bg-primary text-primary-foreground"
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

                    {load.status === 'accepted' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1"
                        onClick={() => { setCancelLoadId(load.id); setCancelReason(''); }}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel Accepted Load
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={!!cancelLoadId} onOpenChange={(o) => !o && setCancelLoadId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Load</DialogTitle>
            <DialogDescription>
              You must provide a reason. The shipper will be notified and the load returned to available.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="heavy-label">Reason for cancellation *</Label>
              <div className="space-y-1.5">
                {CANCEL_REASONS.map((reason) => (
                  <label key={reason} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="driver-cancel-reason"
                      value={reason}
                      checked={cancelReason === reason}
                      onChange={() => setCancelReason(reason)}
                      className="accent-primary"
                    />
                    <span className="text-sm">{reason}</span>
                  </label>
                ))}
              </div>
            </div>
            {cancelReason === 'Other' && (
              <Textarea
                placeholder="Describe the reason..."
                value={cancelCustom}
                onChange={(e) => setCancelCustom(e.target.value)}
                rows={2}
              />
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCancelLoadId(null)}>Keep Trip</Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!cancelReason || (cancelReason === 'Other' && !cancelCustom) || cancelLoad.isPending}
                onClick={() => cancelLoadId && cancelLoad.mutate({ loadId: cancelLoadId, reason: finalCancelReason })}
              >
                {cancelLoad.isPending ? 'Cancelling...' : 'Confirm Cancel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
