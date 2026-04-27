import { useAuth } from '@/hooks/useAuth';
import { Routes, Route } from 'react-router-dom';
import BottomTabs from '@/components/BottomTabs';
import DriverHomeView from '@/components/DriverHomeView';
import DriverWorkView from '@/components/driver/DriverWorkView';
import DriverActiveView from '@/components/driver/DriverActiveView';
import ChatListView from '@/components/ChatListView';
import ProfileView from '@/components/ProfileView';
import LoadHistoryView from '@/components/LoadHistoryView';
import VerificationCenter from '@/components/VerificationCenter';
import NotificationsSettings from '@/components/settings/NotificationsSettings';
import SecuritySettings from '@/components/settings/SecuritySettings';
import PreferredRoutes from '@/components/settings/PreferredRoutes';
import RatingsView from '@/components/settings/RatingsView';
import PaymentMethods from '@/components/settings/PaymentMethods';
import HelpSupport from '@/components/settings/HelpSupport';
import AboutView from '@/components/settings/AboutView';
import SubPageWrapper from '@/components/settings/SubPageWrapper';
import { useLoadNotifications } from '@/hooks/useLoadNotifications';
import { Truck } from 'lucide-react';
import HauliqLogo from '@/components/shared/HauliqLogo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function PageWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="px-4 flex h-14 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <HauliqLogo variant="light" size={20} />
          </div>
          <h1 className="text-base font-black leading-tight">{title}</h1>
        </div>
      </header>
      {children}
    </div>
  );
}

function FleetPage() {
  return (
    <SubPageWrapper title="My Fleet">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Truck className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No vehicles registered</p>
            <p className="text-xs text-muted-foreground mt-1">Add your trucks, trailers, and fleet details</p>
            <Button className="mt-4" size="sm" onClick={() => toast.info('Fleet management coming soon!')}>Add Vehicle</Button>
          </div>
        </CardContent>
      </Card>
    </SubPageWrapper>
  );
}

export default function DriverDashboard() {
  const { user } = useAuth();
  useLoadNotifications(user?.id, 'driver');

  return (
    <div className="min-h-screen bg-background">
      <Routes>
        <Route index element={<DriverHomeView />} />
        <Route path="work" element={<PageWrapper title="Work"><DriverWorkView /></PageWrapper>} />
        <Route path="active" element={<PageWrapper title="Active Trips"><DriverActiveView /></PageWrapper>} />
        <Route path="chat" element={<PageWrapper title="Messages"><main className="px-4 py-4"><ChatListView /></main></PageWrapper>} />

        {/* Direct sidebar routes */}
        <Route path="profile" element={<SubPageWrapper title="Profile"><ProfileView /></SubPageWrapper>} />
        <Route path="subscription" element={<SubPageWrapper title="Subscription"><PaymentMethods /></SubPageWrapper>} />
        <Route path="earnings" element={<SubPageWrapper title="Earnings"><LoadHistoryView role="driver" /></SubPageWrapper>} />
        <Route path="verification" element={<SubPageWrapper title="Verification"><VerificationCenter /></SubPageWrapper>} />
        <Route path="fleet" element={<FleetPage />} />
        <Route path="routes" element={<SubPageWrapper title="Preferred Routes"><PreferredRoutes /></SubPageWrapper>} />
        <Route path="ratings" element={<SubPageWrapper title="Ratings"><RatingsView role="driver" /></SubPageWrapper>} />
        <Route path="notifications" element={<SubPageWrapper title="Notifications"><NotificationsSettings /></SubPageWrapper>} />
        <Route path="security" element={<SubPageWrapper title="Security"><SecuritySettings /></SubPageWrapper>} />
        <Route path="help" element={<SubPageWrapper title="Help & Support"><HelpSupport /></SubPageWrapper>} />
        <Route path="about" element={<SubPageWrapper title="About Hauliq"><AboutView /></SubPageWrapper>} />
      </Routes>
      <BottomTabs role="driver" />
    </div>
  );
}
