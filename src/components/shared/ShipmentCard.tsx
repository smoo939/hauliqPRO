import { Clock, Truck, Bookmark, MessageSquare } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useBookmarks } from '@/hooks/useBookmarks';

export type ShipmentStage = 'posted' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled' | 'process';

interface ShipmentCardProps {
  id: string;
  /** Backwards-compat: title is no longer rendered. */
  title?: string;
  status: ShipmentStage | string;
  pickupLocation: string;
  deliveryLocation: string;
  /** Falls back to formatted date if `postedAt` is missing. */
  pickupDate?: string | null;
  /** Reserved for future detail view; not rendered on the card. */
  deliveryDate?: string | null;
  /** "HH:mm" — shown beneath pickup location. */
  pickupTime?: string | null;
  /** "HH:mm" — shown beneath delivery location. */
  deliveryTime?: string | null;
  /** ISO timestamp of when the load was posted — shown as relative time ("2h ago"). */
  postedAt?: string | null;
  price?: number | null;
  truckType?: string | null;
  onClick?: () => void;
  /** Backwards-compat — featureBox/distance/eta props are accepted but no longer rendered. */
  featureBox?: boolean;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  thumbnailIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  /** Carrier-side bookmark icon. Pass `bookmarkId` to identify the load. */
  bookmarkable?: boolean;
  bookmarkId?: string;
  /** Shipper-side bid pill. Renders only when both props are set. */
  bidCount?: number | null;
  onBidsClick?: () => void;
}

const STAGE_PILL: Record<string, { cls: string; label: string }> = {
  posted: { cls: 'bg-secondary text-foreground', label: 'Posted' },
  process: { cls: 'bg-secondary text-foreground', label: 'Process' },
  accepted: { cls: 'bg-primary/15 text-amber-700 dark:text-amber-300', label: 'Accepted' },
  in_transit: { cls: 'bg-foreground text-background', label: 'Transit' },
  delivered: { cls: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300', label: 'Delivered' },
  cancelled: { cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', label: 'Cancelled' },
};

function formatTime(t?: string | null) {
  if (!t) return null;
  // Accept "HH:mm" or "HH:mm:ss" — render as 12-hour clock
  const [hh, mm] = t.split(':');
  const h = Number(hh);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm ?? '00'} ${period}`;
}

export default function ShipmentCard({
  id,
  status,
  pickupLocation,
  deliveryLocation,
  postedAt,
  pickupDate,
  pickupTime,
  deliveryTime,
  price,
  truckType,
  onClick,
  bookmarkable,
  bookmarkId,
  bidCount,
  onBidsClick,
}: ShipmentCardProps) {
  const pill = STAGE_PILL[status] ?? STAGE_PILL.posted;
  const { has, toggle } = useBookmarks();
  const bId = bookmarkId || id;
  const isBookmarked = bookmarkable ? has(bId) : false;

  const postedLabel = postedAt
    ? formatDistanceToNow(new Date(postedAt), { addSuffix: true })
    : pickupDate
      ? format(new Date(pickupDate), 'd MMM yy')
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left bg-card rounded-[28px] shadow-soft active:scale-[0.99] transition-transform p-5"
      data-testid={`card-shipment-${id}`}
    >
      {/* Header: ID + status + (bookmark) */}
      <div className="flex items-center justify-between gap-3">
        <p className="italic font-medium text-[15px] tracking-tight leading-tight text-foreground truncate">
          ID: {id}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-tight ${pill.cls}`}
          >
            {pill.label}
          </span>
          {bookmarkable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(bId);
              }}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark load'}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                isBookmarked
                  ? 'bg-primary/15 text-primary'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`button-bookmark-${id}`}
            >
              <Bookmark
                className="h-4 w-4"
                strokeWidth={1.8}
                fill={isBookmarked ? 'currentColor' : 'none'}
              />
            </button>
          )}
        </div>
      </div>

      {/* Vertical dotted route */}
      <div className="mt-4 flex">
        <div className="flex flex-col items-center w-6 shrink-0 pt-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary ring-[3px] ring-primary/20" />
          <span className="flex-1 my-1 border-l-2 border-dotted border-muted-foreground/40 min-h-[36px] w-px" />
          <span className="h-2.5 w-2.5 rounded-full bg-card border-2 border-foreground" />
        </div>
        <div className="flex-1 flex flex-col justify-between min-w-0 gap-4 pl-1">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-foreground truncate">{pickupLocation}</p>
            {formatTime(pickupTime) && (
              <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
                {formatTime(pickupTime)}
              </p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-foreground truncate">{deliveryLocation}</p>
            {formatTime(deliveryTime) && (
              <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
                {formatTime(deliveryTime)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Price • Equipment • Posted • (Bids) */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {price != null && price > 0 && (
            <span className="font-sans font-extrabold text-[18px] leading-none tracking-tight text-foreground tabular-nums">
              ${Number(price).toLocaleString()}
            </span>
          )}
          {truckType && (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-foreground/80">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
              <span className="truncate max-w-[110px] capitalize">{truckType}</span>
            </span>
          )}
          {postedLabel && (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
              {postedLabel}
            </span>
          )}
        </div>
        {onBidsClick && bidCount != null && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBidsClick();
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground shrink-0 active:scale-95 transition-transform"
            data-testid={`button-view-bids-${id}`}
          >
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.2} />
            {bidCount} {bidCount === 1 ? 'Bid' : 'Bids'}
          </button>
        )}
      </div>
    </button>
  );
}
