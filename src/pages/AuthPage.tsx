import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogIn, UserPlus, Eye, EyeOff, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AuthPage() {
  const { user, signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('hauliq_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('hauliq_email', email);
      } else {
        localStorage.removeItem('hauliq_email');
      }
      if (isSignUp) {
        await signUp(email, password, fullName, phone);
        toast.success('Account created! Welcome to Hauliq.');
      } else {
        await signIn(email, password);
        toast.success('Welcome back!');
      }
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
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary glow-amber">
            <Truck className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Hauliq</h1>
          <p className="mt-1 text-sm text-muted-foreground">Industrial-grade freight marketplace</p>
        </div>

        <Card className="border-border/60 bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-black">{isSignUp ? 'Create Account' : 'Sign In'}</CardTitle>
            <CardDescription>{isSignUp ? 'Join the marketplace as a shipper or carrier' : 'Welcome back to the platform'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="heavy-label">Full Name</Label>
                    <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="heavy-label">Phone Number</Label>
                    <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+263 77 123 4567" />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="heavy-label">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="heavy-label">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={checked => setRememberMe(checked === true)} />
                <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">Remember my email</Label>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground font-black glow-amber"
                size="lg"
              >
                {loading ? 'Loading...' : isSignUp ? (
                  <><UserPlus className="mr-2 h-4 w-4" /> Create Account</>
                ) : (
                  <><LogIn className="mr-2 h-4 w-4" /> Sign In</>
                )}
              </Button>
            </form>
            <button onClick={() => setIsSignUp(!isSignUp)} className="mt-5 block w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
