import { Badge } from '@/components/ui/badge';
import { Package, Clock, Flame, MapPin, Truck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

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
      className={cn(
        'w-full text-left rounded-xl p-5 active:scale-[0.99] transition-all bg-card shadow-soft hover:shadow-float',
        isRecommended && 'ring-1 ring-primary/30',
      )}
    >
      {/* Header: ID & status row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary shrink-0">
            <Truck className="h-[18px] w-[18px] text-foreground" strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] heavy-label leading-tight">{shortId(load)}</p>
            <p className="text-base font-bold text-foreground tracking-tight leading-snug truncate mt-0.5">
              {load.title}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-xl font-bold text-foreground leading-none tracking-tight">
            ${Number(load.price || 0).toLocaleString()}
          </p>
          {isRecommended && matchScore != null && (
            <span className="pill pill-amber mt-1.5">
              <Flame className="h-2.5 w-2.5" /> {matchScore}%
            </span>
          )}
        </div>
      </div>

      {/* Route */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex flex-col items-center pt-1 shrink-0">
          <span className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
          <span className="w-px h-6 bg-muted my-0.5" />
          <span className="h-2.5 w-2.5 rounded-full border-2 border-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-[10.5px] heavy-label leading-none">Pickup</p>
            <p className="text-[13.5px] font-semibold text-foreground truncate mt-1">{load.pickup_location}</p>
          </div>
          <div>
            <p className="text-[10.5px] heavy-label leading-none">Delivery</p>
            <p className="text-[13.5px] font-semibold text-foreground truncate mt-1">{load.delivery_location}</p>
          </div>
        </div>
      </div>

      {/* Horizontal Processing > Transit > Delivered */}
      <div className="mb-4">
        <div className="flex items-center w-full">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="flex-1 h-[2px] mx-1.5 rounded-full bg-primary" />
          <span className="h-2 w-2 rounded-full bg-primary ring-4 ring-primary/20" />
          <span className="flex-1 h-[2px] mx-1.5 rounded-full bg-muted" />
          <span className="h-2 w-2 rounded-full bg-muted" />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-medium text-foreground">Processing</span>
          <span className="text-[10px] font-medium text-foreground">Transit</span>
          <span className="text-[10px] font-medium text-muted-foreground">Delivered</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {distKm != null && (
          <span className="pill pill-amber">
            <MapPin className="h-2.5 w-2.5" /> {Math.round(distKm)} km
          </span>
        )}
        {load.equipment_type && (
          <Badge variant="muted" className="text-[10.5px] py-0.5">{load.equipment_type}</Badge>
        )}
        {load.load_type && load.load_type !== 'FTL' && (
          <Badge variant="muted" className="text-[10.5px] py-0.5">{load.load_type}</Badge>
        )}
        {load.weight_lbs && (
          <span className="pill pill-muted">
            <Package className="h-2.5 w-2.5" /> {load.weight_lbs.toLocaleString()} kg
          </span>
        )}
        {load.urgent && (
          <span className="pill pill-danger">Urgent</span>
        )}
        <span className="ml-auto text-[10.5px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {formatDistanceToNow(new Date(load.created_at), { addSuffix: true })}
        </span>
      </div>
    </button>
  );
}
