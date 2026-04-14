import { Card, CardContent } from '@/components/ui/card';
import { Truck } from 'lucide-react';

export default function AboutView({ onBack }: { onBack?: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">← Back to Settings</button>
      <Card>
        <CardContent className="p-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Truck className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-black">Hauliq</h2>
          <p className="text-sm text-muted-foreground mt-1">Local-first freight marketplace</p>
          <p className="text-xs text-muted-foreground mt-4">Version 1.0.0</p>
          <p className="text-xs text-muted-foreground mt-1">© 2026 Hauliq. All rights reserved.</p>
          <p className="text-xs text-muted-foreground mt-4 max-w-sm">
            Connecting shippers and carriers across Southern Africa with AI-powered load matching, real-time tracking, and secure payments.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
