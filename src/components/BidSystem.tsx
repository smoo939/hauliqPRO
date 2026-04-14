import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DollarSign, User, Check, X, ShieldAlert, Clock, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useLocalBidForLoad } from '@/lib/localFirst';

interface BidFormProps {
  loadId: string;
}

export function BidForm({ loadId }: BidFormProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const localBid = useLocalBidForLoad(loadId, user?.id);

  // Check verification status for drivers
  const { data: driverVerif } = useQuery({
    queryKey: ['driver-verification-status', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('driver_verifications')
        .select('overall_status')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && profile?.role === 'driver',
  });

  const isVerified = profile?.verified || driverVerif?.overall_status === 'verified';

  const handleSubmit = async () => {
    if (!amount || !user) return;
    if (!isVerified) {
      toast.error('You must complete verification before bidding. Go to Settings → Verification Center.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('bids').insert({
        load_id: loadId,
        driver_id: user.id,
        amount: parseFloat(amount),
        message: message || null,
      });
      if (error) throw error;
      toast.success('Bid saved locally. It will sync automatically.');
      setAmount('');
      setMessage('');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['available-loads'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!showForm) {
    if (localBid) {
      const synced = localBid.status === 'synced';
      return (
        <Badge variant="outline" className={`gap-1.5 ${synced ? 'text-success border-success/30' : 'text-warning border-warning/30'}`} data-testid={`status-bid-${loadId}`}>
          {synced ? <CheckCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {synced ? 'Bid sent' : 'Bid pending'}
        </Badge>
      );
    }
    if (!isVerified && profile?.role === 'driver') {
      return (
        <Button size="sm" variant="outline" className="text-warning border-warning/30" disabled data-testid={`button-verify-bid-${loadId}`}>
          <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Verify to Bid
        </Button>
      );
    }
    return (
      <Button size="sm" variant="default" onClick={() => setShowForm(true)} data-testid={`button-place-bid-${loadId}`}>
        <DollarSign className="mr-1.5 h-3.5 w-3.5" /> Place Bid
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Input
        type="number"
        step="0.01"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Amount (USD)"
        className="w-32 text-sm"
        data-testid={`input-bid-amount-${loadId}`}
      />
      <Input
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Note (optional)"
        className="w-40 text-sm"
        data-testid={`input-bid-message-${loadId}`}
      />
      <Button size="sm" onClick={handleSubmit} disabled={submitting || !amount} data-testid={`button-submit-bid-${loadId}`}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} data-testid={`button-cancel-bid-${loadId}`}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface BidListProps {
  loadId: string;
  onAcceptBid: (bidId: string, driverId: string, amount: number) => void;
}

export function BidList({ loadId, onAcceptBid }: BidListProps) {
  const { data: bids, isLoading } = useQuery({
    queryKey: ['load-bids', loadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('*')
        .eq('load_id', loadId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const driverIds = data.map((b: any) => b.driver_id);
      if (driverIds.length === 0) return [];

      // Fetch profiles, reviews, and truck verifications in parallel
      const [profilesRes, reviewsRes, trucksRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, phone, avatar_url').in('user_id', driverIds),
        supabase.from('reviews').select('reviewed_id, rating').in('reviewed_id', driverIds),
        supabase.from('truck_verifications').select('user_id, truck_label, truck_photo_url, overall_status').in('user_id', driverIds),
      ]);

      const profileMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.user_id, p]));

      // Aggregate reviews per driver
      const reviewMap: Record<string, { avg: number; count: number }> = {};
      for (const r of (reviewsRes.data || [])) {
        if (!reviewMap[r.reviewed_id]) reviewMap[r.reviewed_id] = { avg: 0, count: 0 };
        reviewMap[r.reviewed_id].count++;
        reviewMap[r.reviewed_id].avg += r.rating;
      }
      for (const id of Object.keys(reviewMap)) {
        reviewMap[id].avg = reviewMap[id].avg / reviewMap[id].count;
      }

      const truckMap = Object.fromEntries((trucksRes.data || []).map((t: any) => [t.user_id, t]));

      return data.map((bid: any) => ({
        ...bid,
        driver_profile: profileMap[bid.driver_id],
        driver_reviews: reviewMap[bid.driver_id] || null,
        driver_truck: truckMap[bid.driver_id] || null,
      }));
    },
    refetchInterval: 10000,
  });

  const [expandedBid, setExpandedBid] = useState<string | null>(null);

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading bids...</p>;
  if (!bids?.length) return <p className="text-xs text-muted-foreground">No bids yet</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{bids.length} bid{bids.length !== 1 ? 's' : ''}</p>
      {bids.map((bid: any) => (
        <div key={bid.id} className="rounded-lg border overflow-hidden">
          <div
            className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setExpandedBid(expandedBid === bid.id ? null : bid.id)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted overflow-hidden">
                {bid.driver_truck?.truck_photo_url ? (
                  <img src={bid.driver_truck.truck_photo_url} alt="truck" className="h-8 w-8 object-cover rounded-full" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{bid.driver_profile?.full_name || 'Driver'}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {bid.driver_truck?.truck_label && <span>{bid.driver_truck.truck_label}</span>}
                  {bid.driver_reviews && (
                    <span className="flex items-center gap-0.5">
                      ⭐ {bid.driver_reviews.avg.toFixed(1)} ({bid.driver_reviews.count})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-semibold tabular-nums">${Number(bid.amount).toFixed(2)}</span>
              {bid.status === 'pending' && (
                <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); onAcceptBid(bid.id, bid.driver_id, Number(bid.amount)); }}>
                  Accept
                </Button>
              )}
              {bid.status !== 'pending' && (
                <Badge variant="outline" className={bid.status === 'accepted' ? 'text-success border-success/30' : 'text-muted-foreground'}>
                  {bid.status}
                </Badge>
              )}
            </div>
          </div>

          {/* Expanded carrier profile */}
          {expandedBid === bid.id && (
            <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-2 bg-muted/20">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{bid.driver_profile?.full_name || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-medium">{bid.driver_profile?.phone || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Truck:</span>
                  <p className="font-medium">{bid.driver_truck?.truck_label || 'Not registered'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Verified:</span>
                  <p className="font-medium">{bid.driver_truck?.overall_status === 'verified' ? '✅ Yes' : '⏳ Pending'}</p>
                </div>
              </div>
              {bid.driver_truck?.truck_photo_url && (
                <img
                  src={bid.driver_truck.truck_photo_url}
                  alt="Carrier truck"
                  className="w-full h-32 object-cover rounded-md"
                />
              )}
              {bid.note && (
                <p className="text-xs text-muted-foreground italic">"{bid.note}"</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
