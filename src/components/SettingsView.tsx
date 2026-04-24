import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Moon, Sun, User, LogOut, Shield, Truck, FileText,
  ChevronRight, Bell, Lock, HelpCircle, Info, History,
  MapPin, CreditCard, Star, Package, ArrowLeftRight
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import LoadHistoryView from './LoadHistoryView';
import VerificationCenterComponent from './VerificationCenter';
import NotificationsSettings from './settings/NotificationsSettings';
import SecuritySettings from './settings/SecuritySettings';
import PreferredRoutes from './settings/PreferredRoutes';
import RatingsView from './settings/RatingsView';
import ShippingPreferences from './settings/ShippingPreferences';
import PaymentMethods from './settings/PaymentMethods';
import HelpSupport from './settings/HelpSupport';
import AboutView from './settings/AboutView';

interface SettingItemProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
}

function SettingItem({ icon: Icon, label, description, onClick, trailing, danger }: SettingItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3.5 w-full px-4 py-3 rounded-2xl text-left transition-colors hover:bg-secondary active:bg-muted ${danger ? 'text-destructive' : ''}`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl shrink-0 ${danger ? 'bg-destructive/10' : 'bg-secondary'}`}>
        <Icon className={`h-[18px] w-[18px] ${danger ? 'text-destructive' : 'text-foreground'}`} strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold tracking-tight">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>}
      </div>
      {trailing || <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />}
    </button>
  );
}

export default function SettingsView({ role }: { role: 'shipper' | 'driver' }) {
  const { user, profile, signOut, setRole } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const handleSwitchRole = async () => {
    const newRole = role === 'driver' ? 'shipper' : 'driver';
    setSwitching(true);
    try {
      await setRole(newRole);
      toast.success(`Switched to ${newRole === 'driver' ? 'Carrier' : 'Shipper'} mode`);
      navigate(newRole === 'driver' ? '/driver' : '/shipper', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch role');
    } finally {
      setSwitching(false);
    }
  };

  const back = () => setActiveSection(null);

  // Sub-section routing
  switch (activeSection) {
    case 'history':
      return (
        <div className="space-y-4">
          <button onClick={back} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">← Back to Settings</button>
          <h2 className="text-lg font-semibold">Load History</h2>
          <p className="text-xs text-muted-foreground">All your completed deliveries</p>
          <LoadHistoryView role={role} />
        </div>
      );
    case 'fleet':
      return <FleetManagement onBack={back} />;
    case 'verification':
      return <VerificationCenterComponent onBack={back} />;
    case 'documents':
      return <DocumentVault onBack={back} />;
    case 'notifications':
      return <NotificationsSettings onBack={back} />;
    case 'security':
      return <SecuritySettings onBack={back} />;
    case 'routes':
      return <PreferredRoutes onBack={back} />;
    case 'ratings':
      return <RatingsView onBack={back} role={role} />;
    case 'shipping-prefs':
      return <ShippingPreferences onBack={back} />;
    case 'payments':
      return <PaymentMethods onBack={back} />;
    case 'help':
      return <HelpSupport onBack={back} />;
    case 'about':
      return <AboutView onBack={back} />;
  }

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{profile?.full_name || 'User'}</h3>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize text-xs">
                    {role === 'driver' ? 'Carrier' : 'Shipper'}
                  </Badge>
                  {profile?.verified && (
                    <Badge variant="outline" className="text-xs text-success border-success/30">Verified</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardContent className="p-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3.5 pt-2 pb-1">Appearance</p>
            <SettingItem
              icon={resolvedTheme === 'dark' ? Moon : Sun}
              label="Dark Mode"
              description={resolvedTheme === 'dark' ? 'Currently dark' : 'Currently light'}
              trailing={
                <Switch checked={resolvedTheme === 'dark'} onCheckedChange={checked => setTheme(checked ? 'dark' : 'light')} />
              }
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Role-specific sections */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardContent className="p-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3.5 pt-2 pb-1">
              {role === 'driver' ? 'Carrier Tools' : 'Shipper Tools'}
            </p>
            <SettingItem icon={History} label="Load History" description="View all completed deliveries" onClick={() => setActiveSection('history')} />
            {role === 'driver' ? (
              <>
                <SettingItem icon={CreditCard} label="Subscription" description="$35/mo carrier plan" onClick={() => setActiveSection('payments')} />
                <SettingItem icon={Truck} label="My Fleet" description="Vehicles, trailers & capacity" onClick={() => setActiveSection('fleet')} />
                <SettingItem icon={Shield} label="Verification Center" description="ZIMRA, GIT & operator licenses" onClick={() => setActiveSection('verification')} />
                <SettingItem icon={FileText} label="Document Vault" description="POD uploads & delivery receipts" onClick={() => setActiveSection('documents')} />
                <SettingItem icon={MapPin} label="Preferred Routes" description="Set your common corridors" onClick={() => setActiveSection('routes')} />
                <SettingItem icon={Star} label="Ratings & Reviews" description="Your performance score" onClick={() => setActiveSection('ratings')} />
              </>
            ) : (
              <>
                <SettingItem icon={Package} label="Shipping Preferences" description="Default load types & equipment" onClick={() => setActiveSection('shipping-prefs')} />
                <SettingItem icon={CreditCard} label="Payment Methods" description="EcoCash, bank transfer & cash" onClick={() => setActiveSection('payments')} />
                <SettingItem icon={FileText} label="Document Vault" description="POD downloads & invoices" onClick={() => setActiveSection('documents')} />
                <SettingItem icon={Star} label="Carrier Ratings" description="Rate your carriers" onClick={() => setActiveSection('ratings')} />
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Account */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <CardContent className="p-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3.5 pt-2 pb-1">Account</p>
            <SettingItem icon={Bell} label="Notifications" description="Push & SMS preferences" onClick={() => setActiveSection('notifications')} />
            <SettingItem icon={Lock} label="Security" description="Password & 2FA" onClick={() => setActiveSection('security')} />
            <SettingItem icon={HelpCircle} label="Help & Support" onClick={() => setActiveSection('help')} />
            <SettingItem icon={Info} label="About Hauliq" description="v1.0.0" onClick={() => setActiveSection('about')} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Switch Role */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardContent className="p-2">
            <SettingItem
              icon={ArrowLeftRight}
              label={`Switch to ${role === 'driver' ? 'Shipper' : 'Carrier'}`}
              description={`Currently: ${role === 'driver' ? 'Carrier' : 'Shipper'}`}
              onClick={handleSwitchRole}
              trailing={switching ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : undefined}
            />
          </CardContent>
        </Card>
      </motion.div>

      <Button variant="destructive" className="w-full" onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
}

// Sub-sections kept inline for fleet/verification/documents
function FleetManagement({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">← Back to Settings</button>
      <h2 className="text-lg font-semibold">My Fleet</h2>
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Truck className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No vehicles registered</p>
            <p className="text-xs text-muted-foreground mt-1">Add your trucks, trailers, and fleet details</p>
            <Button className="mt-4" size="sm" onClick={() => toast.info('Fleet management coming soon! Complete truck verification first.')}>Add Vehicle</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// VerificationCenter is now in its own component file

function DocumentVault({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">← Back to Settings</button>
      <h2 className="text-lg font-semibold">Document Vault</h2>
      <p className="text-xs text-muted-foreground">Securely store and manage Proof of Delivery (POD) and other logistics documents</p>
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-xs text-muted-foreground mt-1">Upload PODs and delivery receipts for your completed loads</p>
            <Button className="mt-4" size="sm" onClick={() => toast.info('Document upload coming soon! Complete a load first to upload PODs.')}>Upload Document</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
