import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Bell, MapPin, FileText, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const CONSENT_VERSION = 1;
const storageKey = (userId: string) => `hauliq_consent_v${CONSENT_VERSION}_${userId}`;

export type ConsentRecord = {
  version: number;
  acceptedAt: string;
  termsAndPrivacy: true;
  notifications: boolean;
  location: boolean;
};

export function getConsent(userId: string): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as ConsentRecord) : null;
  } catch {
    return null;
  }
}

export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(true);
  const [agreeRequired, setAgreeRequired] = useState(false);
  const [allowNotifications, setAllowNotifications] = useState(true);
  const [allowLocation, setAllowLocation] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setAccepted(true); return; }
    const existing = getConsent(user.id);
    setAccepted(!!existing);
  }, [user, loading]);

  if (loading || !user || accepted) return <>{children}</>;

  const submit = async () => {
    if (!agreeRequired) {
      toast.error('Please agree to the Terms and Privacy Policy to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const record: ConsentRecord = {
        version: CONSENT_VERSION,
        acceptedAt: new Date().toISOString(),
        termsAndPrivacy: true,
        notifications: allowNotifications,
        location: allowLocation,
      };
      localStorage.setItem(storageKey(user.id), JSON.stringify(record));

      if (allowNotifications && 'Notification' in window && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch { /* ignore */ }
      }
      if (allowLocation && 'geolocation' in navigator) {
        try {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve(),
              () => resolve(),
              { timeout: 8000, maximumAge: 60000 },
            );
          });
        } catch { /* ignore */ }
      }
      setAccepted(true);
      toast.success('Welcome to Hauliq!');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Render the app behind a backdrop so the gate feels app-native */}
      <div aria-hidden className="pointer-events-none">{children}</div>

      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl shadow-float max-h-[92vh] overflow-y-auto">
          <div className="p-6 sm:p-7">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary glow-amber">
              <ShieldCheck className="h-7 w-7 text-primary-foreground" strokeWidth={2} />
            </div>
            <h2 className="text-center text-2xl font-black tracking-tight">Your privacy & permissions</h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Before you start using Hauliq, please confirm how we can use your data and which permissions you'd like to grant.
            </p>

            <div className="mt-5 space-y-3">
              <PermRow
                icon={FileText}
                title="Account data"
                desc="We process the details you provide (name, email, phone, location, role, loads/bids) to run the marketplace and connect shippers with carriers. Required."
                value={true}
                disabled
                onChange={() => {}}
              />
              <PermRow
                icon={Bell}
                title="Notifications"
                desc="Get alerts when bids are placed, accepted or messages arrive. You can change this any time."
                value={allowNotifications}
                onChange={setAllowNotifications}
              />
              <PermRow
                icon={MapPin}
                title="Location"
                desc="Used to surface nearby loads and trucks and improve route suggestions. You can decline and keep using the app."
                value={allowLocation}
                onChange={setAllowLocation}
              />
            </div>

            <label className="mt-5 flex items-start gap-2 cursor-pointer rounded-2xl bg-secondary/60 p-4">
              <Checkbox
                id="consent-agree"
                checked={agreeRequired}
                onCheckedChange={c => setAgreeRequired(c === true)}
                className="mt-0.5"
              />
              <span className="text-xs leading-snug">
                I have read and agree to the{' '}
                <button
                  type="button"
                  onClick={() => navigate('/terms')}
                  className="font-bold text-primary hover:underline"
                >Terms and Conditions</button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => navigate('/privacy')}
                  className="font-bold text-primary hover:underline"
                >Privacy Policy</button>{' '}
                of Hauliq.
              </span>
            </label>

            <button
              onClick={submit}
              disabled={submitting}
              className="mt-5 h-12 w-full rounded-2xl bg-primary text-primary-foreground font-black glow-amber inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> {submitting ? 'Saving...' : 'Agree & Continue'}
            </button>

            <button
              onClick={async () => { await signOut(); }}
              className="mt-3 block w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Not now — sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function PermRow(props: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const { icon: Icon, title, desc, value, disabled, onChange } = props;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-black">{title}</h3>
          {disabled ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Required</span>
          ) : (
            <Toggle value={value} onChange={onChange} />
          )}
        </div>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}
