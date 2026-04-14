import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Bell, MessageSquare, Truck, DollarSign } from 'lucide-react';

export default function NotificationsSettings({ onBack }: { onBack?: () => void }) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [bidNotifs, setBidNotifs] = useState(true);
  const [chatNotifs, setChatNotifs] = useState(true);
  const [statusNotifs, setStatusNotifs] = useState(true);

  const items = [
    { icon: Bell, label: 'Push Notifications', description: 'Receive push alerts', checked: pushEnabled, onChange: setPushEnabled },
    { icon: DollarSign, label: 'Bid Updates', description: 'New bids and bid acceptance', checked: bidNotifs, onChange: setBidNotifs },
    { icon: MessageSquare, label: 'Chat Messages', description: 'New messages on loads', checked: chatNotifs, onChange: setChatNotifs },
    { icon: Truck, label: 'Status Changes', description: 'Load pickup, transit & delivery', checked: statusNotifs, onChange: setStatusNotifs },
  ];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">← Back to Settings</button>
      <h2 className="text-lg font-semibold">Notifications</h2>
      <p className="text-xs text-muted-foreground">Manage your notification preferences</p>
      <Card>
        <CardContent className="p-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-3.5 rounded-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                <item.icon className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Switch checked={item.checked} onCheckedChange={item.onChange} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
