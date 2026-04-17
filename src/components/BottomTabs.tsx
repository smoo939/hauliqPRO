import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, PlusCircle, ClipboardList, Search, Navigation, Briefcase, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Tab {
  path: string;
  label: string;
  icon: React.ElementType;
  highlight?: boolean;
}

export default function BottomTabs({ role }: { role: 'shipper' | 'driver' }) {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs: Tab[] = role === 'shipper'
    ? [
        { path: '/shipper', label: 'Live', icon: Navigation, highlight: true },
        { path: '/shipper/create', label: 'Create', icon: PlusCircle },
        { path: '/shipper/history', label: 'History', icon: ClipboardList },
        { path: '/shipper/chat', label: 'Messages', icon: MessageCircle },
      ]
    : [
        { path: '/driver', label: 'Home', icon: Home },
        { path: '/driver/work', label: 'Work', icon: Briefcase },
        { path: '/driver/active', label: 'Active', icon: Compass },
        { path: '/driver/chat', label: 'Messages', icon: MessageCircle },
      ];

  const activeIndex = tabs.findIndex(t => t.path === location.pathname);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[2000] border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      {/* Active indicator bar — aligned precisely with active tab */}
      <div className="relative flex" style={{ height: '2.5px' }}>
        {tabs.map((tab, i) => (
          <div key={tab.path} className="flex-1 relative overflow-hidden">
            {i === activeIndex && (
              <motion.div
                layoutId="tab-top-indicator"
                className="absolute inset-x-4 top-0 h-full rounded-full bg-primary"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-[11px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : tab.highlight
                    ? 'text-primary/70'
                    : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', tab.highlight && !isActive && 'text-primary/70')} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
