import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, PlusCircle, ClipboardList, Navigation, Briefcase, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Tab {
  path: string;
  label: string;
  icon: React.ElementType;
}

export default function BottomTabs({ role }: { role: 'shipper' | 'driver' }) {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs: Tab[] = role === 'shipper'
    ? [
        { path: '/shipper', label: 'Live', icon: Navigation },
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
    <nav className="fixed bottom-0 left-0 right-0 z-[2000] safe-area-bottom px-3 pb-3">
      <div className="glass shadow-float rounded-3xl flex items-stretch justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10.5px] font-medium"
            >
              {isActive && (
                <motion.div
                  layoutId="tab-active-pill"
                  className="absolute inset-1 rounded-2xl bg-primary/14"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon
                strokeWidth={isActive ? 2 : 1.5}
                className={cn(
                  'h-[22px] w-[22px] relative transition-colors',
                  isActive ? 'text-amber-600 dark:text-amber-300' : 'text-muted-foreground',
                )}
              />
              <span className={cn(
                'relative tracking-tight transition-colors',
                isActive ? 'text-amber-600 dark:text-amber-300 font-semibold' : 'text-muted-foreground',
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
