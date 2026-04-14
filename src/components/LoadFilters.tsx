import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';

export interface LoadFilterValues {
  equipment_type: string;
  load_type: string;
  urgent: boolean | null;
  minPrice: string;
  maxPrice: string;
}

const defaultFilters: LoadFilterValues = {
  equipment_type: '',
  load_type: '',
  urgent: null,
  minPrice: '',
  maxPrice: '',
};

const equipmentOptions = [
  'Flatbed', 'Enclosed', 'Refrigerated', 'Tanker', 'Lowbed', 'Tipper',
  'Curtain-side', 'Container', 'Car Carrier', 'Livestock', 'Logging', 'Side Loader',
];

interface LoadFiltersProps {
  filters: LoadFilterValues;
  onChange: (filters: LoadFilterValues) => void;
}

export default function LoadFilters({ filters, onChange }: LoadFiltersProps) {
  const [open, setOpen] = useState(false);

  const activeCount = [
    filters.equipment_type,
    filters.load_type,
    filters.urgent !== null,
    filters.minPrice,
    filters.maxPrice,
  ].filter(Boolean).length;

  const reset = () => onChange(defaultFilters);

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)} className="gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs text-muted-foreground gap-1">
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Truck Type</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filters.equipment_type}
              onChange={(e) => onChange({ ...filters, equipment_type: e.target.value })}
            >
              <option value="">All types</option>
              {equipmentOptions.map((eq) => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Load Type</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filters.load_type}
                onChange={(e) => onChange({ ...filters, load_type: e.target.value })}
              >
                <option value="">All</option>
                <option value="FTL">FTL</option>
                <option value="LTL">LTL</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Urgency</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filters.urgent === null ? '' : filters.urgent ? 'urgent' : 'normal'}
                onChange={(e) => onChange({ ...filters, urgent: e.target.value === '' ? null : e.target.value === 'urgent' })}
              >
                <option value="">All</option>
                <option value="urgent">Urgent only</option>
                <option value="normal">Normal only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Min Price ($)</label>
              <input
                type="number"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="0"
                value={filters.minPrice}
                onChange={(e) => onChange({ ...filters, minPrice: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Max Price ($)</label>
              <input
                type="number"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="∞"
                value={filters.maxPrice}
                onChange={(e) => onChange({ ...filters, maxPrice: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function applyLoadFilters(loads: any[], filters: LoadFilterValues): any[] {
  return loads.filter((load) => {
    if (filters.equipment_type && load.equipment_type !== filters.equipment_type) return false;
    if (filters.load_type && load.load_type !== filters.load_type) return false;
    if (filters.urgent === true && !load.urgent) return false;
    if (filters.urgent === false && load.urgent) return false;
    if (filters.minPrice && Number(load.price) < Number(filters.minPrice)) return false;
    if (filters.maxPrice && Number(load.price) > Number(filters.maxPrice)) return false;
    return true;
  });
}

export { defaultFilters };
