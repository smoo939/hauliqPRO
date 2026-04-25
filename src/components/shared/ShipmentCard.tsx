import { Map as MapIcon, Clock } from 'lucide-react';
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
  featureBox?: boolean;
  distanceKm?: number | null;
  etaMinutes?: number | null;
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

  const showCenterMetrics = distanceKm != null || etaMinutes != null || truckType;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left bg-card rounded-[28px] shadow-soft active:scale-[0.99] transition-transform p-4 relative overflow-hidden"
    >
      <div className={`flex items-start gap-3 ${featureBox ? 'pr-24' : ''}`}>
        <div className="h-11 w-11 rounded-2xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
          {thumbnailIcon ?? <MiniBoxIcon className="h-7 w-7" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-bold tracking-tight text-foreground truncate">
            ID: {id}
          </p>
          <p className="text-[12px] text-muted-foreground truncate mt-0.5">{title}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-tight ${pill.cls}`}>
          {pill.label}
        </span>
      </div>

      <div className={`mt-4 flex items-center gap-1.5 px-1 relative ${featureBox ? 'pr-24' : ''}`}>
        {dot(stage >= 0)}
        {dash(stage >= 1)}
        {dot(stage >= 1)}
        {dash(stage >= 2)}
        <span className="relative">
          <span className={`inline-flex h-7 w-9 items-center justify-center rounded-full ${stage >= 2 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'} shadow-soft`}>
            <MiniTruckIcon className="h-4 w-[18px]" />
          </span>
        </span>
        {dash(stage >= 3)}
        {dot(stage >= 3)}
      </div>

      {showCenterMetrics && (
        <div className={`mt-3 flex flex-wrap items-center gap-4 ${featureBox ? 'pr-24' : ''}`}>
          {pickupLocation && deliveryLocation && (
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-foreground min-w-0">
              <span className="truncate max-w-[92px]">{pickupLocation}</span>
              <span className="h-px w-10 border-t-2 border-dotted border-muted-foreground/40" />
              <span className="truncate max-w-[92px]">{deliveryLocation}</span>
            </span>
          )}
          {distanceKm != null && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
              <MapIcon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
              {distanceKm.toFixed(0)} KM
            </span>
          )}
          {etaMinutes != null && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
              {formatEta(etaMinutes)}
            </span>
          )}
          {truckType && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground truncate">
              {truckType}
            </span>
          )}
        </div>
      )}

      <div className={`mt-3 flex items-end justify-between gap-3 ${featureBox ? 'pr-24' : ''}`}>
        <div className="min-w-0 flex-1">
          {pickupDate && (
            <p className="text-[11px] text-muted-foreground">
              {format(new Date(pickupDate), 'd MMM yy')}
              {deliveryDate && (
                <span className="ml-2 text-muted-foreground/70">
                  Estimated {format(new Date(deliveryDate), 'd MMM yy')}
                </span>
              )}
            </p>
          )}
          <p className="text-[12px] font-semibold text-foreground truncate mt-0.5">
            {pickupLocation}
            <span className="text-muted-foreground font-normal"> → </span>
            {deliveryLocation}
          </p>
        </div>
        {!featureBox && (rightSlot ?? (price != null && price > 0 && (
          <p className="text-[15px] font-bold tracking-tight whitespace-nowrap">
            ${Number(price).toLocaleString()}
          </p>
        )))}
      </div>

      {featureBox && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <BoxIllustration className="h-[110px] w-[110px] drop-shadow-[0_10px_20px_rgba(217,80,0,0.25)]" />
        </div>
      )}
    </button>
  );
}
