import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Package, Clock, DollarSign, Truck, Gavel, Flame, CheckCheck, ShieldAlert, Timer } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import BackhaulLoads from './BackhaulLoads';
import { useLocalBidForLoad } from '@/lib/localFirst';
import { useQuery } from '@tanstack/react-query';

interface LoadDetailModalProps {
  load: any | null;
  open: boolean;
  onClose: () => void;
  matchScore?: number;
}

const ETA_OPTIONS = [
  { value: '2h', label: '2 hours' },
  { value: '4h', label: '4 hours' },
  { value: '8h', label: '8 hours' },
  { value: '12h', label: '12 hours' },
  { value: '24h', label: '1 day' },
  { value: '48h', label: '2 days' },
  { value: '72h', label: '3 days' },
];

export default function LoadDetailModal({ load, open, onClose, matchScore }: LoadDetailModalProps) {
  const { user, profile } = useAuth();
  const [bidAmount, setBidAmount] = useState('');
  const [bidNote, setBidNote] = useState('');
  const [bidEta, setBidEta] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showBidForm, setShowBidForm] = useState(false);
  const localBid = useLocalBidForLoad(load?.id || '', user?.id);

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

  if (!load) return null;

  const handleBid = async () => {
    if (!user || !bidAmount) return;
    if (!isVerified) {
      toast.error('Complete verification before bidding — go to Settings → Verification Center.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('bids').insert({
        load_id: load.id,
        driver_id: user.id,
        amount: parseFloat(bidAmount),
        note: bidNote || null,
        eta: bidEta || null,
      });
      if (error) throw error;
      toast.success('Bid submitted — will sync automatically.');
      setShowBidForm(false);
      setBidAmount('');
      setBidNote('');
      setBidEta('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit bid');
    } finally {
      setSubmitting(false);
    }
  };

  const alreadyBid = !!localBid;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[88vh] rounded-t-2xl p-0 overflow-hidden bg-card border-t border-border">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-4 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-black">{load.title}</SheetTitle>
              <div className="flex items-center gap-1.5">
                {matchScore != null && matchScore > 0 && (
                  <Badge className="text-[10px] gap-0.5 bg-primary/20 text-primary border-primary/30">
                    <Flame className="h-2.5 w-2.5" /> {matchScore}% Match
                  </Badge>
                )}
                {load.urgent && <Badge variant="destructive" className="text-xs">🚨 Urgent</Badge>}
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Route */}
            <div className="bento-card p-3 flex items-start gap-3">
              <div className="flex flex-col items-center gap-0.5 pt-1">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <div className="w-px h-8 bg-border" />
                <div className="h-3 w-3 rounded-full bg-destructive" />
              </div>
              <div className="space-y-3 flex-1 min-w-0">
                <div>
                  <p className="heavy-label mb-0.5">Pickup</p>
                  <p className="text-sm font-semibold">{load.pickup_location}</p>
                </div>
                <div>
                  <p className="heavy-label mb-0.5">Delivery</p>
                  <p className="text-sm font-semibold">{load.delivery_location}</p>
                </div>
              </div>
            </div>

            {/* Details grid — bento style */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bento-card p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="heavy-label">Budget</span>
                </div>
                <p className="text-xl font-black text-primary">${Number(load.price || 0).toLocaleString()}</p>
              </div>
              {load.weight_lbs && (
                <div className="bento-card p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Package className="h-3.5 w-3.5" />
                    <span className="heavy-label">Weight</span>
                  </div>
                  <p className="text-sm font-bold">{load.weight_lbs.toLocaleString()} kg</p>
                </div>
              )}
              {load.equipment_type && (
                <div className="bento-card p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Truck className="h-3.5 w-3.5" />
                    <span className="heavy-label">Equipment</span>
                  </div>
                  <p className="text-sm font-bold">{load.equipment_type}</p>
                </div>
              )}
              <div className="bento-card p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="heavy-label">Posted</span>
                </div>
                <p className="text-sm font-bold">{formatDistanceToNow(new Date(load.created_at), { addSuffix: true })}</p>
              </div>
            </div>

            {load.pickup_date && (
              <div className="bento-card p-3">
                <p className="heavy-label mb-1">Pickup Date</p>
                <p className="text-sm font-semibold">{format(new Date(load.pickup_date), 'PPP')}</p>
              </div>
            )}

            {load.description && (
              <div className="bento-card p-3">
                <p className="heavy-label mb-1">Description</p>
                <p className="text-sm text-muted-foreground">{load.description}</p>
              </div>
            )}

            {/* Bid sync status */}
            {localBid && (
              <Badge
                variant="outline"
                className={`gap-1.5 w-fit ${localBid.status === 'synced' ? 'text-success border-success/30 bg-success/10' : 'text-warning border-warning/30 bg-warning/10'}`}
                data-testid={`status-bid-${load.id}`}
              >
                {localBid.status === 'synced' ? <CheckCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                {localBid.status === 'synced' ? 'Bid synced ✓' : 'Bid pending sync'}
              </Badge>
            )}

            <BackhaulLoads
              deliveryLocation={load.delivery_location}
              originLocation={load.pickup_location}
              forwardPrice={load.price || 0}
              equipmentType={load.equipment_type}
            />

            {/* Bid form */}
            {showBidForm && (
              <div className="bento-card p-4 space-y-3">
                <p className="text-sm font-black uppercase tracking-wide">Submit Your Bid</p>

                <div className="space-y-1">
                  <Label className="heavy-label">Your Price (USD) *</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 450"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    data-testid={`input-bid-amount-${load.id}`}
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="heavy-label flex items-center gap-1">
                    <Timer className="h-3 w-3" /> Estimated Arrival
                  </Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={bidEta}
                    onChange={(e) => setBidEta(e.target.value)}
                  >
                    <option value="">Select ETA</option>
                    {ETA_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="heavy-label">Note (optional)</Label>
                  <Textarea
                    placeholder="Describe your experience with this load type..."
                    value={bidNote}
                    onChange={(e) => setBidNote(e.target.value)}
                    rows={2}
                    data-testid={`input-bid-note-${load.id}`}
                    className="bg-background/50"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowBidForm(false)} className="flex-1" data-testid={`button-cancel-bid-${load.id}`}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBid}
                    disabled={submitting || !bidAmount}
                    className="flex-1 bg-primary text-primary-foreground font-bold"
                    data-testid={`button-submit-bid-${load.id}`}
                  >
                    {submitting ? 'Saving...' : 'Submit Bid'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Sticky action — bid only */}
          <div className="border-t border-border/60 p-4 bg-card space-y-2">
            {!isVerified ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <ShieldAlert className="h-5 w-5 text-warning shrink-0" />
                <div>
                  <p className="text-sm font-bold text-warning">Verification Required</p>
                  <p className="text-xs text-muted-foreground">Complete verification to submit bids</p>
                </div>
              </div>
            ) : alreadyBid ? (
              <Badge
                variant="outline"
                className={`w-full justify-center h-12 text-sm gap-2 ${localBid?.status === 'synced' ? 'text-success border-success/30 bg-success/10' : 'text-warning border-warning/30 bg-warning/10'}`}
              >
                {localBid?.status === 'synced' ? <CheckCheck className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                {localBid?.status === 'synced' ? 'Bid Submitted & Synced' : 'Bid Pending Sync'}
              </Badge>
            ) : (
              <Button
                onClick={() => setShowBidForm(!showBidForm)}
                className="w-full h-12 text-sm font-black bg-primary text-primary-foreground glow-amber"
                data-testid={`button-place-bid-${load.id}`}
              >
                <Gavel className="h-4 w-4 mr-2" />
                {showBidForm ? 'Cancel Bid' : 'Submit Bid'}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
