import { Map as MapIcon, Clock, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { BoxIllustration, MiniBoxIcon, MiniTruckIcon } from './illustrations';

export type ShipmentStage = 'posted' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled' | 'process';

interface ShipmentCardProps {
  id: string;
  title: string;
  status: ShipmentStage | string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupDate?: string | null;
  deliveryDate?: string | null;
  price?: number | null;
  thumbnailIcon?: React.ReactNode;
  onClick?: () => void;
  rightSlot?: React.ReactNode;
  /** When true, render the big orange 3D box on the right edge of the card */
  featureBox?: boolean;
  /** Distance in km — shown with a map icon */
  distanceKm?: number | null;
  /** ETA in minutes — shown with a clock icon */
  etaMinutes?: number | null;
  /** Required truck/equipment type — shown with a truck icon */
  truckType?: string | null;
}

const STAGE_INDEX: Record<string, number> = {
  posted: 0,
  process: 0,
  accepted: 1,
  in_transit: 2,
  delivered: 3,
};

const STAGE_PILL: Record<string, { cls: string; label: string }> = {
  posted: { cls: 'bg-secondary text-foreground', label: 'Process' },
  process: { cls: 'bg-secondary text-foreground', label: 'Process' },
  accepted: { cls: 'bg-primary/15 text-amber-700 dark:text-amber-300', label: 'Accepted' },
  in_transit: { cls: 'bg-foreground text-background', label: 'Transit' },
  delivered: { cls: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300', label: 'Delivered' },
  cancelled: { cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', label: 'Cancelled' },
};

function formatEta(minutes: number) {
  if (!minutes || minutes < 1) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function ShipmentCard({
  id,
  title,
  status,
  pickupLocation,
  deliveryLocation,
  pickupDate,
  deliveryDate,
  price,
  thumbnailIcon,
  onClick,
  rightSlot,
  featureBox = false,
  distanceKm,
  etaMinutes,
  truckType,
}: ShipmentCardProps) {
  const stage = STAGE_INDEX[status] ?? 0;
  const pill = STAGE_PILL[status] ?? STAGE_PILL.posted;

  const dot = (active: boolean) => (
    <span
      className={`h-2.5 w-2.5 rounded-full ${
        active ? 'bg-primary ring-[3px] ring-primary/20' : 'bg-card border-2 border-muted'
      }`}
    />
  );

  const dash = (active: boolean) => (
    <span
      className={`flex-1 border-t-2 border-dotted ${
        active ? 'border-primary/70' : 'border-muted-foreground/30'
      }`}
    />
  );

  const hasMetrics = price != null || distanceKm != null || etaMinutes != null || !!truckType;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left bg-card rounded-[28px] shadow-soft active:scale-[0.99] transition-transform p-4 relative overflow-hidden"
    >
      {/* Header row */}
      <div className={`flex items-start gap-3 ${featureBox ? 'pr-24' : ''}`}>
        <div className="h-11 w-11 rounded-2xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
          {thumbnailIcon ?? <MiniBoxIcon className="h-7 w-7" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display-italic text-[19px] leading-tight text-foreground truncate">
            ID: {id}
          </p>
          <p className="text-[12px] text-muted-foreground truncate mt-0.5">{title}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-tight ${pill.cls}`}>
          {pill.label}
        </span>
      </div>

      {/* Dotted progress with mini truck illustration */}
      <div className={`mt-4 flex items-center gap-1.5 px-1 relative ${featureBox ? 'pr-24' : ''}`}>
        {dot(stage >= 0)}
        {dash(stage >= 1)}
        {dot(stage >= 1)}
        {dash(stage >= 2)}
        <span className="relative">
          <span className={`inline-flex h-7 w-10 items-center justify-center rounded-full ${
            stage >= 2 ? 'bg-primary' : 'bg-secondary'
          } shadow-soft`}>
            <MiniTruckIcon className="h-4 w-[22px]" />
          </span>
        </span>
        {dash(stage >= 3)}
        {dot(stage >= 3)}
      </div>

      {/* Origin → dotted → Destination */}
      <div className={`mt-3 flex items-center gap-2 ${featureBox ? 'pr-24' : ''}`}>
        <span className="text-[12.5px] font-semibold text-foreground truncate min-w-0 max-w-[42%]">
          {pickupLocation}
        </span>
        <span className="flex-1 border-t-2 border-dotted border-muted-foreground/40" />
        <span className="text-[12.5px] font-semibold text-foreground truncate min-w-0 max-w-[42%] text-right">
          {deliveryLocation}
        </span>
      </div>

      {/* Metrics row: Price • Truck • Distance • ETA */}
      {hasMetrics && (
        <div className={`mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 ${featureBox ? 'pr-24' : ''}`}>
          {price != null && price > 0 && (
            <span className="font-display text-[16px] leading-none text-foreground">
              ${Number(price).toLocaleString()}
            </span>
          )}
          {truckType && (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-foreground/80">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
              <span className="truncate max-w-[110px] capitalize">{truckType}</span>
            </span>
          )}
          {distanceKm != null && (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-foreground/80">
              <MapIcon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
              {distanceKm.toFixed(0)} km
            </span>
          )}
          {etaMinutes != null && (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-foreground/80">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
              {formatEta(etaMinutes)}
            </span>
          )}
        </div>
      )}

      {/* Dates footer */}
      {(pickupDate || rightSlot) && (
        <div className={`mt-2.5 flex items-end justify-between gap-3 ${featureBox ? 'pr-24' : ''}`}>
          {pickupDate ? (
            <p className="text-[11px] text-muted-foreground">
              {format(new Date(pickupDate), 'd MMM yy')}
              {deliveryDate && (
                <span className="ml-2 text-muted-foreground/70">
                  Estimated {format(new Date(deliveryDate), 'd MMM yy')}
                </span>
              )}
            </p>
          ) : <span />}
          {!featureBox && rightSlot}
        </div>
      )}

      {/* Big orange 3D feature box */}
      {featureBox && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <BoxIllustration className="h-[110px] w-[110px] drop-shadow-[0_10px_20px_rgba(217,80,0,0.25)]" />
        </div>
      )}
    </button>
  );
}
