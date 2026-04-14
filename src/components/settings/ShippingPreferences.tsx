import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ShippingPreferences({ onBack }: { onBack?: () => void }) {
  const [loadType, setLoadType] = useState('FTL');
  const [equipment, setEquipment] = useState('Flatbed');

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">← Back to Settings</button>
      <h2 className="text-lg font-semibold">Shipping Preferences</h2>
      <p className="text-xs text-muted-foreground">Set defaults for new loads</p>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Default Load Type</Label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={loadType} onChange={e => setLoadType(e.target.value)}>
              <option value="FTL">Full Truck Load</option>
              <option value="LTL">Less Than Truckload</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Default Equipment</Label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={equipment} onChange={e => setEquipment(e.target.value)}>
              <option value="Flatbed">Flatbed</option>
              <option value="Enclosed">Enclosed</option>
              <option value="Refrigerated">Refrigerated</option>
              <option value="Tanker">Tanker</option>
            </select>
          </div>
          <Button className="w-full" onClick={() => toast.success('Preferences saved!')}>Save Preferences</Button>
        </CardContent>
      </Card>
    </div>
  );
}
