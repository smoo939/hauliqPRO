import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

export default function PreferredRoutes({ onBack }: { onBack?: () => void }) {
  const [routes, setRoutes] = useState<{ from: string; to: string }[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const addRoute = () => {
    if (!from.trim() || !to.trim()) { toast.error('Both cities are required'); return; }
    setRoutes([...routes, { from: from.trim(), to: to.trim() }]);
    setFrom(''); setTo('');
    toast.success('Route added');
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">← Back to Settings</button>
      <h2 className="text-lg font-semibold">Preferred Routes</h2>
      <p className="text-xs text-muted-foreground">Set your common corridors to get matched with relevant loads</p>
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="From city" value={from} onChange={e => setFrom(e.target.value)} />
            <Input placeholder="To city" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <Button size="sm" onClick={addRoute}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add Route</Button>
        </CardContent>
      </Card>
      {routes.map((r, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium">{r.from}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{r.to}</span>
            </div>
            <button onClick={() => setRoutes(routes.filter((_, j) => j !== i))}><X className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
          </CardContent>
        </Card>
      ))}
      {!routes.length && (
        <p className="text-center text-sm text-muted-foreground py-6">No preferred routes set yet</p>
      )}
    </div>
  );
}
