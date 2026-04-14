import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, LogOut, Shield, Phone, Mail, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function ProfileView() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Account</h2>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardContent className="p-5">
            {/* Avatar & name */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{profile?.full_name || 'User'}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{profile?.role || 'No role'}</Badge>
                  {profile?.verified && (
                    <Badge variant="outline" className="text-success border-success/30 gap-1">
                      <CheckCircle className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user?.email}</span>
              </div>
              {profile?.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Joined {profile?.created_at ? format(new Date(profile.created_at), 'MMMM yyyy') : '—'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Account ID: {user?.id?.slice(0, 8)}...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Button variant="destructive" className="w-full" onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
}
