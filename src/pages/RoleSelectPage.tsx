import { useAuth } from '@/hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Truck, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useState } from 'react';

export default function RoleSelectPage() {
  const { user, profile, loading: authLoading, setRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.role === 'shipper') return <Navigate to="/shipper" replace />;
  if (profile?.role === 'driver') return <Navigate to="/driver" replace />;

  const handleSelect = async (role: 'shipper' | 'driver') => {
    setLoading(true);
    try {
      await setRole(role);
      toast.success(`You're now a ${role}!`);
      navigate(role === 'shipper' ? '/shipper' : '/driver', { replace: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg"
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black tracking-tight">Choose Your Role</h1>
          <p className="mt-1 text-muted-foreground">How will you use Hauliq?</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            className="cursor-pointer border-2 border-transparent transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.97]"
            onClick={() => !loading && handleSelect('shipper')}
          >
            <CardContent className="flex flex-col items-center gap-3 pt-8 pb-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Package className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Shipper</h2>
              <p className="text-sm text-muted-foreground">Post loads and find reliable carriers to move your freight</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer border-2 border-transparent transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.97]"
            onClick={() => !loading && handleSelect('driver')}
          >
            <CardContent className="flex flex-col items-center gap-3 pt-8 pb-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Truck className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Carrier</h2>
              <p className="text-sm text-muted-foreground">Browse available loads and accept shipments that fit your route</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
