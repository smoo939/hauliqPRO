import { CloudOff, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLocalFirstSnapshot, useStartLocalFirstSync } from '@/lib/localFirst';

export default function OfflineModeBanner() {
  const { user } = useAuth();
  useStartLocalFirstSync(user?.id);
  const { online, syncActive, pendingBids } = useLocalFirstSnapshot();
  const unsyncedCount = pendingBids.filter((bid) => bid.status !== 'synced').length;

  if (online && !syncActive && unsyncedCount === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none safe-top">
      <div className="mx-auto mt-2 flex w-fit max-w-[92vw] items-center gap-2 rounded-full border border-border/70 bg-card/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur-md">
        {online ? <RefreshCw className={`h-3.5 w-3.5 ${syncActive ? 'animate-spin text-primary' : 'text-success'}`} /> : <CloudOff className="h-3.5 w-3.5 text-warning" />}
        <span>{online ? 'Syncing local changes' : 'Offline Mode'}</span>
        {unsyncedCount > 0 && <span className="text-foreground">{unsyncedCount} pending</span>}
      </div>
    </div>
  );
}
