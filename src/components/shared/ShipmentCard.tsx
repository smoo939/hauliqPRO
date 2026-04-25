import { Truck, Package } from 'lucide-react';
import { format } from 'date-fns';

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
}: ShipmentCardProps) {
  const stage = STAGE_INDEX[status] ?? 0;
  const pill = STAGE_PILL[status] ?? STAGE_PILL.posted;

  const dot = (active: boolean) => (
    <span
      className={`h-2.5 w-2.5 rounded-full ${
        active
          ? 'bg-primary ring-[3px] ring-primary/20'
          : 'bg-card border-2 border-muted'
      }`}
    />
  );

  const dash = (active: boolean) => (
    <span
      className={`flex-1 h-px border-t border-dashed ${
        active ? 'border-primary' : 'border-muted-foreground/30'
      }`}
    />
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-card rounded-[28px] shadow-soft active:scale-[0.99] transition-transform p-4 relative overflow-hidden"
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
          {thumbnailIcon ?? <Package className="h-5 w-5 text-muted-foreground" strokeWidth={1.6} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold tracking-tight text-foreground truncate">
            ID: {id}
          </p>
          <p className="text-[12px] text-muted-foreground truncate mt-0.5">{title}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-tight ${pill.cls}`}>
          {pill.label}
        </span>
      </div>

      {/* Dotted progress with truck icon */}
      <div className="mt-4 flex items-center gap-1.5 px-1 relative">
        {dot(stage >= 0)}
        {dash(stage >= 1)}
        {dot(stage >= 1)}
        {dash(stage >= 2)}
        <span className="relative">
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
            stage >= 2 ? 'bg-primary' : 'bg-secondary'
          } shadow-soft`}>
            <Truck className={`h-3.5 w-3.5 ${stage >= 2 ? 'text-primary-foreground' : 'text-muted-foreground'}`} strokeWidth={2} />
          </span>
        </span>
        {dash(stage >= 3)}
        {dot(stage >= 3)}
      </div>

      {/* Dates + locations */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
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
        {rightSlot ?? (price != null && price > 0 && (
          <p className="text-[15px] font-bold tracking-tight whitespace-nowrap">
            ${Number(price).toLocaleString()}
          </p>
        ))}
      </div>
    </button>
  );
}
