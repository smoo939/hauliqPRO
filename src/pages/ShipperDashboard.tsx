import { useAuth } from '@/hooks/useAuth';
import { Routes, Route } from 'react-router-dom';
import { Package, FileText } from 'lucide-react';
import BottomTabs from '@/components/BottomTabs';
import ShipperLiveView from '@/components/ShipperLiveView';
import ShipperCreateLoad from '@/components/ShipperCreateLoad';
import ShipperShipmentsView from '@/components/ShipperShipmentsView';
import ChatListView from '@/components/ChatListView';
import ProfileView from '@/components/ProfileView';
import LoadHistoryView from '@/components/LoadHistoryView';
import NotificationsSettings from '@/components/settings/NotificationsSettings';
import SecuritySettings from '@/components/settings/SecuritySettings';
import RatingsView from '@/components/settings/RatingsView';
import ShippingPreferences from '@/components/settings/ShippingPreferences';

import HelpSupport from '@/components/settings/HelpSupport';
import AboutView from '@/components/settings/AboutView';
import SubPageWrapper from '@/components/settings/SubPageWrapper';
import { useLoadNotifications } from '@/hooks/useLoadNotifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function PageWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="px-4 flex h-14 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Package className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-base font-black leading-tight">{title}</h1>
        </div>
      </header>
      {children}
    </div>
  );
}

function DocumentsPage() {
  return (
    <SubPageWrapper title="Documents">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-xs text-muted-foreground mt-1">Upload PODs and delivery receipts for your completed loads</p>
            <Button className="mt-4" size="sm" onClick={() => toast.info('Document upload coming soon!')}>Upload Document</Button>
          </div>
        </CardContent>
      </Card>
    </SubPageWrapper>
  );
}

export default function ShipperDashboard() {
  const { user } = useAuth();
  useLoadNotifications(user?.id, 'shipper');

  return (
    <div className="min-h-screen bg-background">
      <Routes>
        <Route index element={<ShipperLiveView />} />
        <Route path="create" element={<PageWrapper title="Create Load"><main className="px-4 py-4"><ShipperCreateLoad /></main></PageWrapper>} />
        <Route path="shipments" element={<PageWrapper title="Shipments"><main className="px-4 py-4"><ShipperShipmentsView /></main></PageWrapper>} />
        <Route path="history" element={<PageWrapper title="Load History"><main className="px-4 py-4"><LoadHistoryView role="shipper" /></main></PageWrapper>} />
        <Route path="chat" element={<PageWrapper title="Messages"><main className="px-4 py-4"><ChatListView /></main></PageWrapper>} />

        {/* Direct sidebar routes */}
        <Route path="profile" element={<SubPageWrapper title="Profile"><ProfileView /></SubPageWrapper>} />


        <Route path="shipping-prefs" element={<SubPageWrapper title="Shipping Preferences"><ShippingPreferences /></SubPageWrapper>} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="ratings" element={<SubPageWrapper title="Shipper Ratings"><RatingsView role="shipper" /></SubPageWrapper>} />
        <Route path="notifications" element={<SubPageWrapper title="Notifications"><NotificationsSettings /></SubPageWrapper>} />
        <Route path="security" element={<SubPageWrapper title="Security"><SecuritySettings /></SubPageWrapper>} />
        <Route path="help" element={<SubPageWrapper title="Help & Support"><HelpSupport /></SubPageWrapper>} />
        <Route path="about" element={<SubPageWrapper title="About Hauliq"><AboutView /></SubPageWrapper>} />
      </Routes>
      <BottomTabs role="shipper" />
    </div>
  );
}
