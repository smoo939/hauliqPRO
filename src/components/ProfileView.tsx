import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, LogOut, Shield, Phone, Mail, Calendar, CheckCircle, Truck, Hash, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function ProfileView() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isCarrier = profile?.role === 'driver';

  const { data: truckData } = useQuery({
    queryKey: ['truck-verification', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('truck_verifications')
        .select('truck_label, registration_number, overall_status')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user && isCarrier,
  });

  const { data: extProfile } = useQuery({
    queryKey: ['ext-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('company_name')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && isCarrier,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Account</h2>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-5">
            {/* Avatar & name */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                {isCarrier ? <Truck className="h-8 w-8 text-primary" /> : <User className="h-8 w-8 text-primary" />}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{profile?.full_name || 'User'}</h3>
                {extProfile?.company_name && (
                  <p className="text-xs text-muted-foreground">{extProfile.company_name}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {isCarrier ? 'Carrier' : profile?.role || 'No role'}
                  </Badge>
                  {profile?.verified && (
                    <Badge variant="outline" className="text-success border-success/30 gap-1 text-[10px]">
                      <CheckCircle className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Contact details */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              {profile?.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{profile.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Joined {profile?.created_at ? format(new Date(profile.created_at), 'MMMM yyyy') : '—'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground text-xs">ID: {user?.id?.slice(0, 8)}...</span>
              </div>
            </div>

            {/* Carrier / Truck details */}
            {isCarrier && (
              <div className="mt-4 border-t pt-4 space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Truck Details</p>
                {extProfile?.company_name && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Company</p>
                      <p className="font-medium">{extProfile.company_name}</p>
                    </div>
                  </div>
                )}
                {truckData?.truck_label && (
                  <div className="flex items-center gap-3 text-sm">
                    <Truck className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Truck Type</p>
                      <p className="font-medium">{truckData.truck_label}</p>
                    </div>
                  </div>
                )}
                {truckData?.registration_number && (
                  <div className="flex items-center gap-3 text-sm">
                    <Hash className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Plate Number</p>
                      <p className="font-mono font-bold tracking-wider">{truckData.registration_number}</p>
                    </div>
                  </div>
                )}
                {truckData?.overall_status && (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${truckData.overall_status === 'verified' ? 'text-success border-success/30 bg-success/10' : 'text-warning border-warning/30 bg-warning/10'}`}
                    >
                      {truckData.overall_status === 'verified' ? '✓ Verified' : '⏳ Pending Verification'}
                    </Badge>
                  </div>
                )}
                {!truckData && (
                  <p className="text-xs text-muted-foreground italic">No truck details saved yet. Update your profile to add truck info.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Button variant="destructive" className="w-full" onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
}
