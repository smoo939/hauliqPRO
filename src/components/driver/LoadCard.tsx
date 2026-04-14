import { Badge } from '@/components/ui/badge';
import { MapPin, Package, Clock, ChevronRight, Flame } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LoadCardProps {
  load: {
    id: string;
    title: string;
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
  isRecommended?: boolean;
}

export default function LoadCard({ load, onTap, matchScore, isRecommended }: LoadCardProps) {
  return (
    <button
      onClick={onTap}
      className={`w-full text-left bg-card border rounded-xl p-3 active:scale-[0.98] transition-all ${
        isRecommended
          ? 'border-amber-500/30 shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)]'
          : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Match score badge */}
          {matchScore != null && matchScore >= 40 && (
            <Badge className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0 mb-0.5">
              <Flame className="h-2.5 w-2.5" /> {matchScore}% Match
            </Badge>
          )}

          {/* Route */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <div className="w-px h-3 bg-border" />
              <div className="h-2 w-2 rounded-full bg-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-sm font-medium truncate">{load.pickup_location}</p>
              <p className="text-foreground text-sm truncate">{load.delivery_location}</p>
            </div>
          </div>

          {/* Tags row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {load.equipment_type && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {load.equipment_type}
              </Badge>
            )}
            {load.load_type && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {load.load_type}
              </Badge>
            )}
            {load.weight_lbs && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Package className="h-3 w-3" />
                {load.weight_lbs.toLocaleString()} lbs
              </span>
            )}
            {load.urgent && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                🚨 Urgent
              </Badge>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(load.created_at), { addSuffix: true })}
          </div>
        </div>

        {/* Price + chevron */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <p className="text-lg font-black text-primary">
            ${Number(load.price || 0).toLocaleString()}
          </p>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}
