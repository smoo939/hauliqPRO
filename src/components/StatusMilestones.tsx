import { cn } from '@/lib/utils';

const milestones = [
  { key: 'accepted', label: 'Processing' },
  { key: 'in_transit', label: 'Transit' },
  { key: 'delivered', label: 'Delivered' },
];

const statusOrder = ['posted', 'accepted', 'in_transit', 'delivered'];

interface StatusMilestonesProps {
  currentStatus: string;
}

export default function StatusMilestones({ currentStatus }: StatusMilestonesProps) {
  const currentIndex = statusOrder.indexOf(currentStatus);

  return (
    <div className="w-full">
      {/* dot + line track */}
      <div className="flex items-center w-full">
        {milestones.map((m, i) => {
          const stepIndex = statusOrder.indexOf(m.key);
          const isComplete = currentIndex >= stepIndex;
          const isCurrent = currentStatus === m.key;
          return (
            <div key={m.key} className="flex items-center flex-1 last:flex-initial">
              <div className="flex items-center justify-center">
                <span
                  className={cn(
                    'block rounded-full transition-all',
                    isCurrent
                      ? 'h-3 w-3 bg-primary ring-4 ring-primary/20'
                      : isComplete
                        ? 'h-2.5 w-2.5 bg-primary'
                        : 'h-2.5 w-2.5 bg-muted',
                  )}
                />
              </div>
              {i < milestones.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-[3px] mx-1.5 rounded-full',
                    currentIndex > stepIndex ? 'bg-primary' : 'bg-muted',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* labels — aligned with dots */}
      <div className="flex justify-between mt-2 px-[2px]">
        {milestones.map((m) => {
          const stepIndex = statusOrder.indexOf(m.key);
          const isComplete = currentIndex >= stepIndex;
          return (
            <span
              key={m.key}
              className={cn(
                'text-[11px] font-medium tracking-tight',
                isComplete ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {m.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
