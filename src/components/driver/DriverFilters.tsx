import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const EQUIPMENT_TYPES = ['Flatbed', 'Dry Van', 'Refrigerated', 'Tanker', 'Lowboy', 'Car Carrier', 'Container'];
const CARGO_TYPES = ['FTL', 'LTL', 'Partial'];

export interface Filters {
  maxDistance: number;
  minPrice: number;
  equipment: string[];
  cargoType: string[];
  urgentOnly: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  maxDistance: 500,
  minPrice: 0,
  equipment: [],
  cargoType: [],
  urgentOnly: false,
};

interface DriverFiltersProps {
  filters: Filters;
  onChange: (f: Filters) => void;
}

export default function DriverFilters({ filters, onChange }: DriverFiltersProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<Filters>(filters);

  const activeCount =
    (local.equipment.length > 0 ? 1 : 0) +
    (local.cargoType.length > 0 ? 1 : 0) +
    (local.minPrice > 0 ? 1 : 0) +
    (local.urgentOnly ? 1 : 0);

  const toggleArr = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const apply = () => {
    onChange(local);
    setOpen(false);
  };

  const reset = () => {
    setLocal(DEFAULT_FILTERS);
    onChange(DEFAULT_FILTERS);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full h-8 gap-1 text-xs bg-card/80 backdrop-blur-sm border-border">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Filters</SheetTitle>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={reset}>
              Reset all
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-6 overflow-y-auto pb-20">
          {/* Min Price */}
          <div>
            <p className="text-sm font-medium mb-2">Minimum Price: ${local.minPrice}</p>
            <Slider
              value={[local.minPrice]}
              onValueChange={([v]) => setLocal({ ...local, minPrice: v })}
              max={5000}
              step={50}
            />
          </div>

          {/* Equipment */}
          <div>
            <p className="text-sm font-medium mb-2">Equipment Type</p>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_TYPES.map((eq) => (
                <Badge
                  key={eq}
                  variant={local.equipment.includes(eq) ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setLocal({ ...local, equipment: toggleArr(local.equipment, eq) })}
                >
                  {eq}
                </Badge>
              ))}
            </div>
          </div>

          {/* Cargo type */}
          <div>
            <p className="text-sm font-medium mb-2">Cargo Type</p>
            <div className="flex flex-wrap gap-1.5">
              {CARGO_TYPES.map((ct) => (
                <Badge
                  key={ct}
                  variant={local.cargoType.includes(ct) ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setLocal({ ...local, cargoType: toggleArr(local.cargoType, ct) })}
                >
                  {ct}
                </Badge>
              ))}
            </div>
          </div>

          {/* Urgent */}
          <div>
            <Badge
              variant={local.urgentOnly ? 'destructive' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setLocal({ ...local, urgentOnly: !local.urgentOnly })}
            >
              🚨 Urgent loads only
            </Badge>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
          <Button className="w-full h-11 font-bold" onClick={apply}>
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
