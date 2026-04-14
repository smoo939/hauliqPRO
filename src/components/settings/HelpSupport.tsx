import { Card, CardContent } from '@/components/ui/card';
import { HelpCircle, Mail, MessageSquare, FileText } from 'lucide-react';

export default function HelpSupport({ onBack }: { onBack?: () => void }) {
  const items = [
    { icon: FileText, label: 'FAQ', description: 'Frequently asked questions', action: () => window.open('https://hauliq.com/faq', '_blank') },
    { icon: MessageSquare, label: 'Live Chat', description: 'Chat with our support team', action: () => { const el = document.querySelector('[data-chatbot-trigger]') as HTMLButtonElement; if (el) el.click(); else alert('Use the Hauliq AI chatbot (bottom-right) for live support.'); } },
    { icon: Mail, label: 'Email Support', description: 'support@hauliq.com', action: () => window.location.href = 'mailto:support@hauliq.com' },
  ];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">← Back to Settings</button>
      <h2 className="text-lg font-semibold">Help & Support</h2>
      {items.map((item) => (
        <Card key={item.label} className="cursor-pointer hover:border-primary/30 transition-all" onClick={item.action}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <item.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
