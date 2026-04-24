import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  User, LogOut, Shield, Truck, CreditCard, Star,
  Moon, Sun, ArrowLeftRight, HelpCircle,
  Menu, DollarSign, Bell, MapPin, ChevronRight,
  Lock, Info, Package, FileText,
} from 'lucide-react';
import { toast } from 'sonner';

interface AppSidebarProps {
  role: 'shipper' | 'driver';
}

export default function AppSidebar({ role }: AppSidebarProps) {
  const { user, profile, signOut, setRole } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const base = role === 'driver' ? '/driver' : '/shipper';

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/auth', { replace: true });
  };

  const handleSwitchRole = async () => {
    const newRole = role === 'driver' ? 'shipper' : 'driver';
    setSwitching(true);
    try {
      await setRole(newRole);
      toast.success(`Switched to ${newRole === 'driver' ? 'Carrier' : 'Shipper'} mode`);
      setOpen(false);
      navigate(newRole === 'driver' ? '/driver' : '/shipper', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch role');
    } finally {
      setSwitching(false);
    }
  };

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const driverItems = [
    { icon: User, label: 'Profile', path: `${base}/profile` },
    { icon: CreditCard, label: 'Subscription', path: `${base}/subscription` },
    { icon: DollarSign, label: 'Earnings', path: `${base}/earnings` },
    { icon: Shield, label: 'Verification', path: `${base}/verification` },
    { icon: Truck, label: 'My Fleet', path: `${base}/fleet` },
    { icon: MapPin, label: 'Preferred Routes', path: `${base}/routes` },
    { icon: Star, label: 'Ratings', path: `${base}/ratings` },
    { icon: Bell, label: 'Notifications', path: `${base}/notifications` },
    { icon: Lock, label: 'Security', path: `${base}/security` },
    { icon: HelpCircle, label: 'Help & Support', path: `${base}/help` },
    { icon: Info, label: 'About Hauliq', path: `${base}/about` },
  ];

  const shipperItems = [
    { icon: User, label: 'Profile', path: `${base}/profile` },
    { icon: Package, label: 'Shipping Preferences', path: `${base}/shipping-prefs` },
    { icon: FileText, label: 'Documents', path: `${base}/documents` },
    { icon: Star, label: 'Shipper Ratings', path: `${base}/ratings` },
    { icon: Bell, label: 'Notifications', path: `${base}/notifications` },
    { icon: Lock, label: 'Security', path: `${base}/security` },
    { icon: HelpCircle, label: 'Help & Support', path: `${base}/help` },
    { icon: Info, label: 'About Hauliq', path: `${base}/about` },
  ];

  const menuItems = role === 'driver' ? driverItems : shipperItems;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex h-10 w-10 items-center justify-center rounded-2xl glass shadow-soft">
          <Menu className="h-4 w-4 text-foreground" strokeWidth={1.8} />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] p-0 flex flex-col bg-background">
        {/* Profile header */}
        <div className="p-5 pb-3 shrink-0">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary glow-amber">
                <User className="h-6 w-6 text-primary-foreground" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-[15px] font-bold truncate tracking-tight">
                  {profile?.full_name || 'User'}
                </SheetTitle>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                <span className="pill pill-amber capitalize mt-1">
                  {role === 'driver' ? 'Carrier' : 'Shipper'}
                </span>
              </div>
            </div>
          </SheetHeader>
        </div>

        <Separator className="shrink-0" />

        {/* Scrollable menu items */}
        <div className="flex-1 overflow-y-auto py-2 min-h-0">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => go(item.path)}
              className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-secondary active:bg-muted transition-colors"
            >
              <item.icon className="h-[18px] w-[18px] text-foreground" strokeWidth={1.6} />
              <span className="text-[14px] font-medium flex-1">{item.label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.5} />
            </button>
          ))}

          {/* Switch role inline */}
          <button
            onClick={handleSwitchRole}
            disabled={switching}
            className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-secondary active:bg-muted transition-colors"
          >
            <ArrowLeftRight className="h-[18px] w-[18px] text-primary" strokeWidth={1.8} />
            <span className="text-[14px] font-medium flex-1">
              Switch to {role === 'driver' ? 'Shipper' : 'Carrier'}
            </span>
            {switching ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </button>
        </div>

        {/* Sticky bottom: dark mode + sign out */}
        <div className="shrink-0 bg-card/95 backdrop-blur-sm p-3 space-y-1">
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-2xl hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-3">
              {resolvedTheme === 'dark' ? (
                <Moon className="h-[18px] w-[18px] text-foreground" strokeWidth={1.6} />
              ) : (
                <Sun className="h-[18px] w-[18px] text-foreground" strokeWidth={1.6} />
              )}
              <span className="text-[14px] font-medium">Dark Mode</span>
            </div>
            <Switch
              checked={resolvedTheme === 'dark'}
              onCheckedChange={(c) => setTheme(c ? 'dark' : 'light')}
              className="pointer-events-none"
            />
          </button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
