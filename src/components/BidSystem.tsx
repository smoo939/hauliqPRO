import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DollarSign, User, ShieldAlert, Clock, CheckCheck, Gavel, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { useLocalBidForLoad } from '@/lib/localFirst';

const ETA_OPTIONS = [
  { value: '2h', label: '2 hours' },
  { value: '4h', label: '4 hours' },
  { value: '8h', label: '8 hours' },
  { value: '12h', label: '12 hours' },
  { value: '24h', label: '1 day' },
  { value: '48h', label: '2 days' },
  { value: '72h', label: '3 days' },
];

interface BidFormProps {
  loadId: string;
}

export function BidForm({ loadId }: BidFormProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [eta, setEta] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const localBid = useLocalBidForLoad(loadId, user?.id);

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
      toast.error('Complete verification before bidding — go to Settings → Verification Center.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('bids').insert({
        load_id: loadId,
        driver_id: user.id,
        amount: parseFloat(amount),
        message: message || null,
        eta: eta || null,
      });
      if (error) throw error;
      toast.success('Bid submitted — will sync automatically.');
      setAmount('');
      setMessage('');
      setEta('');
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
        <Badge
          variant="outline"
          className={`gap-1.5 ${synced ? 'text-success border-success/30 bg-success/10' : 'text-warning border-warning/30 bg-warning/10'}`}
          data-testid={`status-bid-${loadId}`}
        >
          {synced ? <CheckCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {synced ? 'Bid sent ✓' : 'Bid pending'}
        </Badge>
      );
    }
    if (!isVerified && profile?.role === 'driver') {
      return (
        <Button size="sm" variant="outline" className="text-warning border-warning/30 gap-1.5" disabled data-testid={`button-verify-bid-${loadId}`}>
          <ShieldAlert className="h-3.5 w-3.5" /> Verify to Bid
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        className="bg-primary text-primary-foreground font-bold gap-1.5"
        onClick={() => setShowForm(true)}
        data-testid={`button-place-bid-${loadId}`}
      >
        <Gavel className="h-3.5 w-3.5" /> Submit Bid
      </Button>
    );
  }

  return (
    <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
      <p className="text-xs font-black uppercase tracking-wide text-primary">Submit Bid</p>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Price (USD)"
            className="w-28 text-sm h-8"
            data-testid={`input-bid-amount-${loadId}`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm h-8"
            value={eta}
            onChange={e => setEta(e.target.value)}
          >
            <option value="">ETA</option>
            {ETA_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <Input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Note (optional)"
          className="w-36 text-sm h-8"
          data-testid={`input-bid-message-${loadId}`}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-xs" data-testid={`button-cancel-bid-${loadId}`}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !amount}
          className="bg-primary text-primary-foreground font-bold text-xs"
          data-testid={`button-submit-bid-${loadId}`}
        >
          {submitting ? 'Saving...' : 'Submit'}
        </Button>
      </div>
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

      const [profilesRes, reviewsRes, trucksRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, phone, avatar_url').in('user_id', driverIds),
        supabase.from('reviews').select('reviewed_id, rating').in('reviewed_id', driverIds),
        supabase.from('truck_verifications').select('user_id, truck_label, truck_photo_url, overall_status').in('user_id', driverIds),
      ]);

      const profileMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.user_id, p]));
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
  if (!bids?.length) return <p className="text-xs text-muted-foreground italic">No bids yet — carriers will bid here</p>;

  return (
    <div className="space-y-2">
      <p className="heavy-label">{bids.length} bid{bids.length !== 1 ? 's' : ''} received</p>
      {bids.map((bid: any) => (
        <div key={bid.id} className="rounded-lg border border-border/60 overflow-hidden">
          <div
            className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setExpandedBid(expandedBid === bid.id ? null : bid.id)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted overflow-hidden border border-border">
                {bid.driver_truck?.truck_photo_url ? (
                  <img src={bid.driver_truck.truck_photo_url} alt="truck" className="h-9 w-9 object-cover rounded-full" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{bid.driver_profile?.full_name || 'Carrier'}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {bid.driver_truck?.truck_label && <span>{bid.driver_truck.truck_label}</span>}
                  {bid.driver_reviews && (
                    <span className="flex items-center gap-0.5 text-primary font-semibold">
                      ⭐ {bid.driver_reviews.avg.toFixed(1)} ({bid.driver_reviews.count})
                    </span>
                  )}
                  {bid.eta && (
                    <span className="flex items-center gap-0.5">
                      <Timer className="h-2.5 w-2.5" /> {bid.eta}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-base font-black text-primary tabular-nums">${Number(bid.amount).toFixed(0)}</span>
              {bid.status === 'pending' && (
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground font-bold text-xs h-7"
                  onClick={(e) => { e.stopPropagation(); onAcceptBid(bid.id, bid.driver_id, Number(bid.amount)); }}
                >
                  Assign
                </Button>
              )}
              {bid.status !== 'pending' && (
                <Badge
                  variant="outline"
                  className={bid.status === 'accepted' ? 'text-success border-success/30 bg-success/10' : 'text-muted-foreground'}
                >
                  {bid.status}
                </Badge>
              )}
            </div>
          </div>

          {/* Expanded carrier profile */}
          {expandedBid === bid.id && (
            <div className="px-3 pb-3 pt-2 border-t border-border/40 space-y-3 bg-muted/20">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="heavy-label">Carrier Name</p>
                  <p className="font-semibold mt-0.5">{bid.driver_profile?.full_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="heavy-label">Phone</p>
                  <p className="font-semibold mt-0.5">{bid.driver_profile?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="heavy-label">Truck</p>
                  <p className="font-semibold mt-0.5">{bid.driver_truck?.truck_label || 'Not registered'}</p>
                </div>
                <div>
                  <p className="heavy-label">Verified</p>
                  <p className="font-semibold mt-0.5">{bid.driver_truck?.overall_status === 'verified' ? '✅ Verified' : '⏳ Pending'}</p>
                </div>
                {bid.eta && (
                  <div className="col-span-2">
                    <p className="heavy-label">Estimated Arrival</p>
                    <p className="font-semibold mt-0.5 text-primary">{bid.eta}</p>
                  </div>
                )}
              </div>
              {bid.driver_truck?.truck_photo_url && (
                <img
                  src={bid.driver_truck.truck_photo_url}
                  alt="Carrier truck"
                  className="w-full h-36 object-cover rounded-lg border border-border/60"
                />
              )}
              {bid.note && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2">"{bid.note}"</p>
              )}
              {bid.status === 'pending' && (
                <Button
                  size="sm"
                  className="w-full bg-primary text-primary-foreground font-bold glow-amber"
                  onClick={() => onAcceptBid(bid.id, bid.driver_id, Number(bid.amount))}
                >
                  Assign This Carrier
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
