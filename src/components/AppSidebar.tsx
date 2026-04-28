import { useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  User, LogOut, Shield, Truck, CreditCard, Star,
  Moon, Sun, ArrowLeftRight, HelpCircle,
  Menu, DollarSign, Bell, MapPin, ChevronRight,
  Lock, Info, Package, FileText, Camera,
} from 'lucide-react';
import { toast } from 'sonner';

interface AppSidebarProps {
  role: 'shipper' | 'driver';
}

export default function AppSidebar({ role }: AppSidebarProps) {
  const { user, profile, signOut, setRole, refreshProfile } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const base = role === 'driver' ? '/driver' : '/shipper';

  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

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

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Image must be under 4MB');
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('verification-documents')
        .upload(path, file);
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('verification-documents').getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);
      if (updErr) throw updErr;
      await refreshProfile();
      toast.success('Profile picture updated');
    } catch (err: any) {
      toast.error(err.message || 'Could not upload image');
    } finally {
      setUploadingAvatar(false);
    }
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
    { icon: Truck, label: 'Browse Carriers', path: `${base}/carriers` },
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
        <button
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-full overflow-hidden glass shadow-soft"
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Menu className="h-4 w-4 text-foreground" strokeWidth={1.8} />
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[300px] p-0 flex flex-col bg-background">
        {/* Hidden file input for avatar upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarFile}
        />

        {/* Profile header */}
        <div className="p-5 pb-3 shrink-0">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Upload profile picture"
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full overflow-hidden bg-primary glow-amber group"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[18px] font-bold text-primary-foreground tracking-tight">
                    {initials}
                  </span>
                )}
                {/* Camera overlay */}
                <span className="absolute inset-0 flex items-center justify-center bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Camera className="h-4 w-4 text-white" strokeWidth={1.8} />
                  )}
                </span>
                {/* Always-visible tiny camera badge */}
                <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-card shadow-soft flex items-center justify-center">
                  {uploadingAvatar ? (
                    <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <Camera className="h-2.5 w-2.5 text-foreground" strokeWidth={2} />
                  )}
                </span>
              </button>
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
            <p className="mt-2 text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/70 font-semibold">
              Tap photo to change
            </p>
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
