import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Gavel, Bookmark, MapPin, Clock, Inbox, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { useLocalFirstSnapshot } from '@/lib/localFirst';

export default function DriverWorkView() {
  const { user } = useAuth();
  const { pendingBids, loads } = useLocalFirstSnapshot();
  const bids = pendingBids
    .filter((bid) => bid.driver_id === user?.id)
    .map((bid) => ({ ...bid, loads: loads.find((load) => load.id === bid.load_id) || null }));

  const statusColor = (s: string) => {
    switch (s) {
      case 'accepted': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'rejected': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'synced': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      case 'synced': return 'Submitted';
      case 'syncing': return 'Sending';
      case 'failed': return 'Retrying';
      default: return 'Awaiting Response';
    }
  };

  return (
    <div className="px-4 py-4 pb-24 space-y-6">
      {/* My Bids */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-3">
          <Gavel className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">My Bids</h2>
          {bids && <Badge variant="secondary" className="text-[10px]">{bids.length}</Badge>}
        </div>

        {!bids?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center py-10 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No bids yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Find loads on the Home tab and place your first bid
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {bids.map((bid: any) => (
              <Card key={bid.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] px-1.5 py-0 h-5 border ${statusColor(bid.status)}`}>
                          {bid.status === 'synced' ? <CheckCheck className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                          {statusLabel(bid.status)}
                        </Badge>
                      </div>
                      {bid.loads && (
                        <>
                          <div className="flex items-center gap-1.5 text-xs">
                            <MapPin className="h-3 w-3 text-primary shrink-0" />
                            <span className="truncate text-foreground">{bid.loads.pickup_location}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="truncate text-foreground">{bid.loads.delivery_location}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(bid.created_at), { addSuffix: true })}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-primary">${bid.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Your bid</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.section>

      {/* Saved Loads */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center gap-2 mb-3">
          <Bookmark className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">Saved Loads</h2>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center py-10 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Bookmark className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No saved loads</p>
            <p className="text-xs text-muted-foreground mt-1">
              Bookmark loads you're interested in from the Home tab
            </p>
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}
