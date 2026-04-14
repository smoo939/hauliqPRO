import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SubHeaderProps {
  title: string;
  backTo?: string;
  children?: React.ReactNode;
}

export default function SubHeader({ title, backTo, children }: SubHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="px-4 flex h-14 items-center gap-3">
        {backTo && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(backTo)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-base font-semibold leading-tight truncate flex-1">{title}</h1>
        {children}
      </div>
    </header>
  );
}
