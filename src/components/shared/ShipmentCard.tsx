import { Clock, Truck, Bookmark, MessageSquare } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useBookmarks } from '@/hooks/useBookmarks';

export type ShipmentStage = 'posted' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled' | 'process';
export type ViewerRole = 'shipper' | 'driver';

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
  /**
   * Audience for the card. Controls header pill behavior:
   *  - 'driver': hides the "Posted" status pill on available loads (cleaner for carriers).
   *  - 'shipper': replaces the "Posted" status pill with a clickable "X Bids" pill.
   */
  viewerRole?: ViewerRole;
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
  const [hh, mm] = t.split(':');
  const h = Number(hh);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm ?? '00'} ${period}`;
}

function formatDateShort(d?: string | null) {
  if (!d) return null;
  try {
    return format(new Date(d), 'EEE d MMM');
  } catch {
    return null;
  }
}

function joinDateTime(dateStr?: string | null, timeStr?: string | null) {
  const d = formatDateShort(dateStr);
  const t = formatTime(timeStr);
  if (d && t) return `${d} · ${t}`;
  return d || t || null;
}

/** Decorative 3D parcel illustration shown bottom-right of the card. */
function ParcelDecor() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -right-3 -bottom-3 h-[88px] w-[88px] sm:h-[96px] sm:w-[96px] opacity-95 select-none"
    >
      <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_8px_18px_rgba(251,146,60,0.35)]">
        {/* Top face */}
        <polygon
          points="50,8 90,28 50,48 10,28"
          fill="#FDBA74"
        />
        {/* Right face (front-right) */}
        <polygon
          points="90,28 90,72 50,92 50,48"
          fill="#F97316"
        />
        {/* Left face (front-left) */}
        <polygon
          points="10,28 10,72 50,92 50,48"
          fill="#EA580C"
        />
        {/* Top tape */}
        <polygon
          points="50,8 60,13 50,18 40,13"
          fill="#C2410C"
          opacity="0.55"
        />
        {/* Vertical tape on right face */}
        <polygon
          points="65,38 75,33 75,77 65,82"
          fill="#9A3412"
          opacity="0.35"
        />
        {/* Highlight on top */}
        <polygon
          points="50,8 90,28 70,18 50,12"
          fill="#FED7AA"
          opacity="0.55"
        />
      </svg>
    </div>
  );
}

export default function ShipmentCard({
  id,
  status,
  pickupLocation,
  deliveryLocation,
  postedAt,
  pickupDate,
  deliveryDate,
  pickupTime,
  deliveryTime,
  price,
  truckType,
  onClick,
  bookmarkable,
  bookmarkId,
  bidCount,
  onBidsClick,
  viewerRole,
}: ShipmentCardProps) {
  const stagePill = STAGE_PILL[status] ?? STAGE_PILL.posted;
  const { has, toggle } = useBookmarks();
  const bId = bookmarkId || id;
  const isBookmarked = bookmarkable ? has(bId) : false;

  const postedLabel = postedAt
    ? formatDistanceToNow(new Date(postedAt), { addSuffix: true })
    : null;

  const pickupWhen = joinDateTime(pickupDate, pickupTime);
  const deliveryWhen = joinDateTime(deliveryDate, deliveryTime);

  // Header pill rules:
  //  - Driver looking at a posted load: hide the status pill entirely.
  //  - Shipper looking at a posted load: replace it with a "X Bids" pill.
  //  - Otherwise (other statuses): show the actual stage pill.
  const isPosted = status === 'posted';
  const showStagePill = !(viewerRole === 'driver' && isPosted) && !(viewerRole === 'shipper' && isPosted);
  const showBidsPill = viewerRole === 'shipper' && isPosted;
  const bidsValue = bidCount ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full text-left bg-card rounded-[28px] shadow-soft active:scale-[0.99] transition-transform p-5 overflow-hidden"
      data-testid={`card-shipment-${id}`}
    >
      {/* Header: status / bids + bookmark — right aligned */}
      <div className="relative z-10 flex items-center justify-end gap-2 min-h-[28px]">
        {showStagePill && (
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-tight ${stagePill.cls}`}
          >
            {stagePill.label}
          </span>
        )}
        {showBidsPill && (
          <span
            role={onBidsClick ? 'button' : undefined}
            onClick={(e) => {
              if (!onBidsClick) return;
              e.stopPropagation();
              onBidsClick();
            }}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold tracking-tight ${
              bidsValue > 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground'
            } ${onBidsClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
            data-testid={`pill-bids-${id}`}
          >
            <MessageSquare className="h-3 w-3" strokeWidth={2.2} />
            {bidsValue} {bidsValue === 1 ? 'Bid' : 'Bids'}
          </span>
        )}
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

      {/* Vertical dotted route — leave room for parcel on the right */}
      <div className="relative z-10 mt-3 flex pr-16">
        <div className="flex flex-col items-center w-6 shrink-0 pt-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary ring-[3px] ring-primary/20" />
          <span className="flex-1 my-1 border-l-2 border-dotted border-muted-foreground/40 min-h-[36px] w-px" />
          <span className="h-2.5 w-2.5 rounded-full bg-card border-2 border-foreground" />
        </div>
        <div className="flex-1 flex flex-col justify-between min-w-0 gap-4 pl-1">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground truncate">{pickupLocation}</p>
            {pickupWhen && (
              <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
                {pickupWhen}
              </p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground truncate">{deliveryLocation}</p>
            {deliveryWhen && (
              <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
                {deliveryWhen}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Price • Equipment • Posted */}
      <div className="relative z-10 mt-4 flex items-center gap-3 pr-16">
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
      </div>

      {/* Decorative orange parcel — bottom-right */}
      <ParcelDecor />
    </button>
  );
}
