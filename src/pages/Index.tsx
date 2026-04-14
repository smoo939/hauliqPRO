import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

const Index = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!profile?.role) return <Navigate to="/role-select" replace />;
  if (profile.role === 'shipper') return <Navigate to="/shipper" replace />;
  return <Navigate to="/driver" replace />;
};

export default Index;
