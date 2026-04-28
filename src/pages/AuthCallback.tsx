import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      const params = new URLSearchParams(hash);
      const token = params.get('token');
      const userId = params.get('user_id');
      const email = params.get('email');
      const name = params.get('name');

      if (!token || !userId) {
        toast.error('Sign-in failed. Please try again.');
        navigate('/auth', { replace: true });
        return;
      }

      await supabase.auth.setSession({
        access_token: token,
        token_type: 'bearer',
        user: {
          id: userId,
          email: email || '',
          user_metadata: { full_name: name || '' },
        },
      } as any);

      toast.success('Signed in with Google');
      // Clean URL fragment
      window.history.replaceState({}, document.title, '/role-select');
      navigate('/role-select', { replace: true });
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
      </div>
    </div>
  );
}
