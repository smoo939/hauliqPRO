import { Badge } from '@/components/ui/badge';
import { Package, Clock, Flame, Truck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LoadCardProps {
  load: {
    id: string;
    title: string;
    tracking_code?: string | null;
    pickup_location: string;
    delivery_location: string;
    price: number | null;
    equipment_type: string | null;
    weight_lbs: number | null;
    urgent: boolean | null;
    load_type: string | null;
    created_at: string;
    pickup_date: string | null;
  };
  onTap: () => void;
  matchScore?: number;
  distKm?: number | null;
  isRecommended?: boolean;
}

function shortId(load: LoadCardProps['load']): string {
  if (load.tracking_code) return load.tracking_code.toUpperCase();
  return `HLQ-${load.id.slice(0, 6).toUpperCase()}`;
}

export default function LoadCard({ load, onTap, matchScore, distKm, isRecommended }: LoadCardProps) {
  return (
    <button
      onClick={onTap}
      className={`w-full text-left rounded-2xl p-3.5 active:scale-[0.98] transition-all border ${
        isRecommended
          ? 'bg-primary/8 border-primary/30'
          : 'bg-card border-border/60'
      }`}
    >
      {/* Header: tracking ID + fare */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/80 shrink-0">
            <Truck className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-black tracking-wide text-foreground">{shortId(load)}</p>
            {isRecommended && matchScore != null && (
              <div className="flex items-center gap-0.5 mt-0.5">
                <Flame className="h-2.5 w-2.5 text-primary" />
                <span className="text-[10px] text-primary font-bold">{matchScore}% Match</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-primary leading-none">${Number(load.price || 0).toLocaleString()}</p>
          {load.urgent && (
            <span className="text-[9px] font-bold text-destructive uppercase">🚨 Urgent</span>
          )}
        </div>
      </div>

      {/* Route */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <div className="w-px h-4 bg-border" />
          <div className="h-2 w-2 rounded-full border-2 border-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-semibold text-foreground truncate">{load.pickup_location}</p>
          <p className="text-xs text-muted-foreground truncate">{load.delivery_location}</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {distKm != null && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-bold border border-primary/25">
            {Math.round(distKm)}km
          </span>
        )}
        {load.equipment_type && (
          <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 font-medium">
            {load.equipment_type}
          </Badge>
        )}
        {load.load_type && load.load_type !== 'FTL' && (
          <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 font-medium">
            {load.load_type}
          </Badge>
        )}
        {load.weight_lbs && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Package className="h-2.5 w-2.5" />
            {load.weight_lbs.toLocaleString()} kg
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {formatDistanceToNow(new Date(load.created_at), { addSuffix: true })}
        </span>
      </div>
    </button>
  );
}
