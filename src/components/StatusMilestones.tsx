import { CheckCircle, Circle, Truck, MapPin, Flag, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

const milestones = [
  { key: 'accepted', label: 'Dispatched', icon: Truck },
  { key: 'in_transit', label: 'In Transit', icon: Navigation },
  { key: 'delivered', label: 'Delivered', icon: Flag },
];

const statusOrder = ['posted', 'accepted', 'in_transit', 'delivered'];

interface StatusMilestonesProps {
  currentStatus: string;
}

export default function StatusMilestones({ currentStatus }: StatusMilestonesProps) {
  const currentIndex = statusOrder.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1 w-full py-2">
      {milestones.map((m, i) => {
        const stepIndex = statusOrder.indexOf(m.key);
        const isComplete = currentIndex >= stepIndex;
        const isCurrent = currentStatus === m.key;
        const Icon = m.icon;

        return (
          <div key={m.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                  isComplete
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground',
                  isCurrent && 'animate-pulse-glow'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className={cn(
                'text-[10px] font-medium',
                isComplete ? 'text-primary' : 'text-muted-foreground'
              )}>
                {m.label}
              </span>
            </div>
            {i < milestones.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-1 rounded-full mt-[-14px]',
                currentIndex > stepIndex ? 'bg-primary' : 'bg-border'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
