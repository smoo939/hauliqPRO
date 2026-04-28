import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { MessageCircle, Package, XCircle, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import LoadChat from '@/components/LoadChat';
import { BidList } from '@/components/BidSystem';
import { AICarrierMatch, AIDynamicPricing } from '@/components/AILoadInsights';
import StatusMilestones from '@/components/StatusMilestones';
import LiveTrackingMap from '@/components/LiveTrackingMap';
import ShipmentCard from '@/components/shared/ShipmentCard';
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
  const [bidsOpenLoadId, setBidsOpenLoadId] = useState<string | null>(null);
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

  const loadIds = (loads || []).map((l: any) => l.id);

  const { data: bidCounts } = useQuery<Record<string, number>>({
    queryKey: ['shipper-bid-counts', user?.id, loadIds.join(',')],
    queryFn: async () => {
      if (!loadIds.length) return {};
      const { data, error } = await supabase
        .from('bids')
        .select('load_id, status')
        .in('load_id', loadIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const bid of data || []) {
        if (bid.status === 'rejected') continue;
        counts[bid.load_id] = (counts[bid.load_id] || 0) + 1;
      }
      return counts;
    },
    enabled: !!user && loadIds.length > 0,
    refetchInterval: 15000,
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
            {displayLoads.map((load: any, i: number) => {
              const count = bidCounts?.[load.id] ?? 0;
              const showBidsButton = load.status === 'posted';
              const bidsExpanded = bidsOpenLoadId === load.id;
              return (
                <motion.div
                  key={load.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="space-y-2"
                >
                  <ShipmentCard
                    id={load.tracking_code || load.id.slice(0, 8).toUpperCase()}
                    status={load.status}
                    pickupLocation={load.pickup_location}
                    deliveryLocation={load.delivery_location}
                    pickupDate={load.pickup_date}
                    deliveryDate={load.delivery_date}
                    pickupTime={load.pickup_time}
                    deliveryTime={load.delivery_time}
                    postedAt={load.created_at}
                    price={load.price}
                    truckType={load.equipment_type}
                    viewerRole="shipper"
                    bidCount={showBidsButton ? count : null}
                    onBidsClick={
                      showBidsButton
                        ? () => setBidsOpenLoadId(bidsExpanded ? null : load.id)
                        : undefined
                    }
                    onClick={() => {
                      if (showBidsButton) {
                        setBidsOpenLoadId(bidsExpanded ? null : load.id);
                      }
                    }}
                  />

                  {/* Tracking + status milestones for accepted/in_transit loads */}
                  {['accepted', 'in_transit'].includes(load.status) && (
                    <div className="rounded-2xl bg-card shadow-soft p-4 space-y-3">
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

                  {/* Bids panel — toggled by the bid pill on the card */}
                  {showBidsButton && bidsExpanded && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl bg-card shadow-soft p-4 space-y-3"
                    >
                      <div className="flex flex-wrap gap-2">
                        <AICarrierMatch load={load} />
                        <AIDynamicPricing load={load} />
                      </div>
                      <BidList
                        loadId={load.id}
                        onAcceptBid={(bidId, driverId, amount) =>
                          acceptBid.mutate({ bidId, driverId, amount, loadId: load.id })
                        }
                      />
                    </motion.div>
                  )}

                  {/* Post-delivery rating for shippers */}
                  {load.status === 'delivered' &&
                    load.driver_id &&
                    !reviewedLoadIds.has(load.id) && (
                      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">Rate Your Carrier</p>
                          <p className="text-xs text-muted-foreground">How was the delivery experience?</p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-primary text-primary-foreground font-bold glow-amber"
                          onClick={() => {
                            setRatingLoadId(load.id);
                            setRatingDriverId(load.driver_id);
                          }}
                        >
                          <Star className="h-3.5 w-3.5 mr-1" /> Rate
                        </Button>
                      </div>
                    )}
                  {load.status === 'delivered' && reviewedLoadIds.has(load.id) && (
                    <p className="px-4 text-xs text-success font-semibold flex items-center gap-1">
                      <Star className="h-3 w-3 fill-success" /> Carrier rated
                    </p>
                  )}

                  {/* Cancellation info */}
                  {load.status === 'cancelled' && load.cancellation_reason && (
                    <p className="px-4 text-xs text-muted-foreground">
                      Reason: {load.cancellation_reason}
                    </p>
                  )}

                  {/* Action row: chat / cancel / delete */}
                  {(['posted', 'accepted', 'in_transit'].includes(load.status)) && (
                    <div className="flex items-center gap-1 px-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1"
                        onClick={() => setChatLoadId(chatLoadId === load.id ? null : load.id)}
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Chat
                      </Button>
                      {['posted', 'accepted'].includes(load.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1"
                          onClick={() => {
                            setCancelLoadId(load.id);
                            setCancelReason('');
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                      {load.status === 'posted' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1 ml-auto"
                          disabled={deleteLoad.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Delete this load? It will be removed from the marketplace.',
                              )
                            ) {
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
                    <div className="rounded-2xl bg-card shadow-soft p-4">
                      <LoadChat loadId={load.id} loadStatus={load.status} />
                    </div>
                  )}
                </motion.div>
              );
            })}
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
