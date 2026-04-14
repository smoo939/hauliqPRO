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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[2000] border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
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
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] w-8 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className={cn('h-5 w-5', tab.highlight && !isActive && 'text-primary/70')} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
