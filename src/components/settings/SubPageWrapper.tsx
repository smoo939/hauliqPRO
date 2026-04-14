import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface SubPageWrapperProps {
  title: string;
  children: React.ReactNode;
}

export default function SubPageWrapper({ title, children }: SubPageWrapperProps) {
  const navigate = useNavigate();

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="px-4 flex h-14 items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <h1 className="text-base font-bold leading-tight">{title}</h1>
        </div>
      </header>
      <main className="px-4 py-4">{children}</main>
    </div>
  );
}
