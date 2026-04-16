import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, Package, XCircle, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import LoadChat from '@/components/LoadChat';
import { BidList } from '@/components/BidSystem';
import { AICarrierMatch, AIDynamicPricing } from '@/components/AILoadInsights';
import StatusMilestones from '@/components/StatusMilestones';
import LiveTrackingMap from '@/components/LiveTrackingMap';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const statusColors: Record<string, string> = {
  posted: 'bg-primary/10 text-primary border-primary/30',
  accepted: 'bg-primary/10 text-primary border-primary/30',
  in_transit: 'bg-warning/10 text-warning border-warning/30',
  delivered: 'bg-success/10 text-success border-success/30',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
};

const CANCEL_REASONS = [
  'Change of plans',
  'Found another carrier',
  'Cargo not ready',
  'Route changed',
  'Budget constraints',
  'Other',
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              star <= (hovered || value)
                ? 'fill-primary text-primary'
                : 'text-muted-foreground/30'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ShipperShipmentsView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chatLoadId, setChatLoadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [cancelLoadId, setCancelLoadId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelCustom, setCancelCustom] = useState('');
  const [ratingLoadId, setRatingLoadId] = useState<string | null>(null);
  const [ratingDriverId, setRatingDriverId] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

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

  const { data: myReviews } = useQuery({
    queryKey: ['shipper-reviews-given', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews')
        .select('load_id')
        .eq('reviewer_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const reviewedLoadIds = new Set((myReviews || []).map((r: any) => r.load_id));

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shipper-loads'] }); toast.success('Carrier assigned!'); },
    onError: (err: any) => toast.error(err.message),
  });

  const cancelLoad = useMutation({
    mutationFn: async ({ loadId, reason }: { loadId: string; reason: string }) => {
      const { error } = await supabase.from('loads').update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_by: 'shipper',
      }).eq('id', loadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipper-loads'] });
      toast.success('Load cancelled.');
      setCancelLoadId(null);
      setCancelReason('');
      setCancelCustom('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteLoad = useMutation({
    mutationFn: async (loadId: string) => {
      const { error } = await supabase.from('loads').update({
        status: 'cancelled',
        cancellation_reason: '__deleted__',
        cancelled_by: 'shipper',
      }).eq('id', loadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipper-loads'] });
      toast.success('Load deleted.');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const submitRating = useMutation({
    mutationFn: async ({ loadId, driverId, rating, comment }: { loadId: string; driverId: string; rating: number; comment: string }) => {
      const { error } = await supabase.from('reviews').insert({
        load_id: loadId,
        reviewer_id: user!.id,
        reviewed_id: driverId,
        rating,
        comment: comment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipper-reviews-given'] });
      toast.success('Rating submitted!');
      setRatingLoadId(null);
      setRatingDriverId(null);
      setRatingStars(5);
      setRatingComment('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const displayLoads = activeTab === 'active'
    ? loads?.filter((l: any) => !['delivered', 'cancelled'].includes(l.status))
    : loads?.filter((l: any) => ['delivered', 'cancelled'].includes(l.status) && l.cancellation_reason !== '__deleted__');

  const finalCancelReason = cancelReason === 'Other' ? cancelCustom : cancelReason;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black">My Shipments</h2>

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button onClick={() => setActiveTab('active')} className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${activeTab === 'active' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
          Active
        </button>
        <button onClick={() => setActiveTab('completed')} className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${activeTab === 'completed' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
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
                    {/* Header row */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[10px] uppercase tracking-wide font-bold ${statusColors[load.status] || ''}`}>
                          {load.status.replace('_', ' ')}
                        </Badge>
                        {load.urgent && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide font-bold bg-destructive/10 text-destructive border-destructive/30">
                            🚨 Urgent
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-black text-foreground">${Number(load.price).toFixed(0)}</span>
                    </div>

                    {/* Route */}
                    <div className="px-4 pb-3">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-0.5 pt-1">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <div className="w-px h-6 bg-border" />
                          <div className="h-2 w-2 rounded-full border-2 border-primary" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div><p className="heavy-label">Pickup</p><p className="text-sm font-medium truncate">{load.pickup_location}</p></div>
                          <div><p className="heavy-label">Delivery</p><p className="text-sm font-medium truncate">{load.delivery_location}</p></div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setChatLoadId(chatLoadId === load.id ? null : load.id)}>
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Footer row */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-t border-border/40 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground truncate">{load.title}</span>
                      <span className="ml-auto shrink-0">{load.pickup_date ? format(new Date(load.pickup_date), 'MMM d') : ''}</span>
                      {load.equipment_type && <span>· {load.equipment_type}</span>}
                    </div>

                    {/* Status milestones & map */}
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

                    {/* Bids section */}
                    {load.status === 'posted' && (
                      <div className="px-4 py-3 border-t border-border/40 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <AICarrierMatch load={load} />
                          <AIDynamicPricing load={load} />
                        </div>
                        <BidList loadId={load.id} onAcceptBid={(bidId, driverId, amount) => acceptBid.mutate({ bidId, driverId, amount, loadId: load.id })} />
                      </div>
                    )}

                    {/* Post-delivery rating for shippers */}
                    {load.status === 'delivered' && load.driver_id && !reviewedLoadIds.has(load.id) && (
                      <div className="px-4 py-3 border-t border-primary/20 bg-primary/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold">Rate Your Carrier</p>
                            <p className="text-xs text-muted-foreground">How was the delivery experience?</p>
                          </div>
                          <Button
                            size="sm"
                            className="bg-primary text-primary-foreground font-bold glow-amber"
                            onClick={() => { setRatingLoadId(load.id); setRatingDriverId(load.driver_id); }}
                          >
                            <Star className="h-3.5 w-3.5 mr-1" /> Rate
                          </Button>
                        </div>
                      </div>
                    )}
                    {load.status === 'delivered' && reviewedLoadIds.has(load.id) && (
                      <div className="px-4 py-2 border-t border-border/40">
                        <p className="text-xs text-success font-semibold flex items-center gap-1">
                          <Star className="h-3 w-3 fill-success" /> Carrier rated
                        </p>
                      </div>
                    )}

                    {/* Cancellation info */}
                    {load.status === 'cancelled' && load.cancellation_reason && (
                      <div className="px-4 py-2 border-t border-border/40">
                        <p className="text-xs text-muted-foreground">Reason: {load.cancellation_reason}</p>
                      </div>
                    )}

                    {/* Cancel / Delete buttons for active loads */}
                    {['posted', 'accepted'].includes(load.status) && (
                      <div className="px-4 py-2 border-t border-border/40 flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1"
                          onClick={() => { setCancelLoadId(load.id); setCancelReason(''); }}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </Button>
                        {load.status === 'posted' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1 ml-auto"
                            disabled={deleteLoad.isPending}
                            onClick={() => {
                              if (window.confirm('Delete this load? It will be removed from the marketplace.')) {
                                deleteLoad.mutate(load.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Chat */}
                    {chatLoadId === load.id && (
                      <div className="px-4 py-3 border-t border-border/40">
                        <LoadChat loadId={load.id} loadStatus={load.status} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Cancel Load Dialog */}
      <Dialog open={!!cancelLoadId} onOpenChange={(o) => !o && setCancelLoadId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Load</DialogTitle>
            <DialogDescription>Please provide a reason for cancellation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="heavy-label">Reason</Label>
              <div className="space-y-1.5">
                {CANCEL_REASONS.map((reason) => (
                  <label key={reason} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cancel-reason"
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
              <Button variant="outline" className="flex-1" onClick={() => setCancelLoadId(null)}>Keep Load</Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!cancelReason || (cancelReason === 'Other' && !cancelCustom) || cancelLoad.isPending}
                onClick={() => cancelLoadId && cancelLoad.mutate({ loadId: cancelLoadId, reason: finalCancelReason })}
              >
                {cancelLoad.isPending ? 'Cancelling...' : 'Cancel Load'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rate Carrier Dialog */}
      <Dialog open={!!ratingLoadId} onOpenChange={(o) => !o && setRatingLoadId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rate Your Carrier</DialogTitle>
            <DialogDescription>Share your experience to help other shippers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-sm text-muted-foreground">How would you rate this delivery?</p>
              <StarRating value={ratingStars} onChange={setRatingStars} />
              <p className="text-sm font-bold text-primary">
                {ratingStars === 5 ? 'Excellent!' : ratingStars === 4 ? 'Good' : ratingStars === 3 ? 'Average' : ratingStars === 2 ? 'Below average' : 'Poor'}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="heavy-label">Comment (optional)</Label>
              <Textarea
                placeholder="What went well? Any concerns?"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRatingLoadId(null)}>Skip</Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground font-bold"
                disabled={submitRating.isPending}
                onClick={() => ratingLoadId && ratingDriverId && submitRating.mutate({
                  loadId: ratingLoadId,
                  driverId: ratingDriverId,
                  rating: ratingStars,
                  comment: ratingComment,
                })}
              >
                {submitRating.isPending ? 'Submitting...' : 'Submit Rating'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
