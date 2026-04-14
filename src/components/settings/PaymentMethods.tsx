import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, Lock, Sparkles, CheckCircle, Rocket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PaymentMethods({ onBack }: { onBack?: () => void }) {
  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
          ← Back to Settings
        </button>
      )}
      <h2 className="text-lg font-semibold">Carrier Subscription</h2>
      <p className="text-xs text-muted-foreground">
        Pay $35/month to access premium carrier features
      </p>

      {/* Beta banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-3">
          <Rocket className="h-8 w-8 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-primary">Free Beta Access</p>
            <p className="text-xs text-muted-foreground">
              Hauliq is currently in free beta — all features are unlocked. Subscriptions will be introduced soon.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Features included */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold">What's included</p>
          {['Accept & bid on all loads', 'AI-powered load matching', 'Real-time GPS tracking', 'Priority support', 'Earnings analytics'].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Disabled payment form */}
      <Card className="opacity-50 pointer-events-none select-none">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Pay via Mobile Money</p>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </div>
          </div>

          <div className="h-10 rounded-md border border-input bg-muted flex items-center px-3">
            <span className="text-sm text-muted-foreground">Select mobile money provider</span>
          </div>

          <div className="h-10 rounded-md border border-input bg-muted flex items-center px-3">
            <span className="text-sm text-muted-foreground">Phone number</span>
          </div>

          <div className="rounded-lg bg-muted p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly subscription</span>
              <span className="font-bold text-muted-foreground">$35.00</span>
            </div>
          </div>

          <div className="h-12 rounded-md bg-muted flex items-center justify-center">
            <Lock className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-sm font-bold text-muted-foreground">Pay $35.00 — Coming Soon</span>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            Secured by ContiPay · Available at launch
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
