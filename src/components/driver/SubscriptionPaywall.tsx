import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Lock, Sparkles, CheckCircle, Rocket } from 'lucide-react';

interface SubscriptionPaywallProps {
  open: boolean;
  onClose: () => void;
}

export default function SubscriptionPaywall({ open, onClose }: SubscriptionPaywallProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">Hauliq Beta</DialogTitle>
              <DialogDescription className="text-xs">
                Free access during beta period
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center space-y-2">
            <Sparkles className="h-6 w-6 text-primary mx-auto" />
            <p className="text-sm font-semibold text-foreground">
              🎉 Hauliq is currently in free beta
            </p>
            <p className="text-xs text-muted-foreground">
              All features are unlocked. Subscriptions will be introduced soon.
            </p>
          </div>

          <div className="space-y-2">
            {['Accept & bid on all loads', 'AI-powered load matching', 'Real-time tracking', 'Priority support'].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-foreground">{f}</span>
              </div>
            ))}
          </div>

          {/* Disabled payment section - visual placeholder */}
          <div className="rounded-lg bg-muted p-4 text-center opacity-50 pointer-events-none select-none">
            <p className="text-2xl font-black text-muted-foreground">$35<span className="text-sm font-medium">/month</span></p>
            <p className="text-xs text-muted-foreground mt-1">Coming soon — free during beta</p>
          </div>

          <div className="opacity-50 pointer-events-none space-y-3">
            <div className="h-10 rounded-md border border-input bg-muted flex items-center px-3">
              <span className="text-sm text-muted-foreground">Select mobile money provider</span>
            </div>
            <div className="h-10 rounded-md border border-input bg-muted flex items-center px-3">
              <span className="text-sm text-muted-foreground">Phone number</span>
            </div>
          </div>

          <div className="h-12 rounded-md bg-muted flex items-center justify-center opacity-50 pointer-events-none">
            <Lock className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-sm font-bold text-muted-foreground">Pay $35.00 — Coming Soon</span>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            Payments powered by ContiPay · Available at launch
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Badge component for home screen - now shows BETA
export function SubscriptionBadge() {
  return (
    <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/30">
      <Sparkles className="h-2.5 w-2.5" /> BETA
    </Badge>
  );
}
