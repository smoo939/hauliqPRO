import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogIn, UserPlus, Eye, EyeOff, Truck, Package, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const TRUCK_TYPES = [
  'Flatbed', 'Enclosed / Box Body', 'Refrigerated (Reefer)', 'Tanker',
  'Lowbed / Low Loader', 'Tipper / Dump Truck', 'Curtain-side',
  'Container Carrier', 'Car Carrier', 'Livestock Carrier', 'Logging Truck', 'Side Loader',
];

export default function AuthPage() {
  const { user, signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'shipper' | 'driver'>('shipper');
  const [companyName, setCompanyName] = useState('');
  const [truckType, setTruckType] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [capacityTonnes, setCapacityTonnes] = useState('');
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

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignUp) {
      setLoading(true);
      try {
        if (rememberMe) localStorage.setItem('hauliq_email', email);
        else localStorage.removeItem('hauliq_email');
        await signIn(email, password);
        toast.success('Welcome back!');
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (role === 'driver') {
      setStep(2);
    } else {
      setLoading(true);
      try {
        if (rememberMe) localStorage.setItem('hauliq_email', email);
        else localStorage.removeItem('hauliq_email');
        await (signUp as any)(email, password, fullName, phone, { role: 'shipper' });
        toast.success('Account created! Welcome to Hauliq.');
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckType) { toast.error('Please select your truck type'); return; }
    setLoading(true);
    try {
      if (rememberMe) localStorage.setItem('hauliq_email', email);
      else localStorage.removeItem('hauliq_email');
      await (signUp as any)(email, password, fullName, phone, {
        role: 'driver',
        company_name: companyName || undefined,
        truck_type: truckType,
        plate_number: plateNumber || undefined,
        capacity_tonnes: capacityTonnes || undefined,
      });
      toast.success('Carrier account created! Welcome to Hauliq.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetToggles = () => {
    setIsSignUp(v => !v);
    setStep(1);
    setRole('shipper');
    setCompanyName('');
    setTruckType('');
    setPlateNumber('');
    setCapacityTonnes('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
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
        </div>

        <Card className="border-border/60 bg-card">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              {isSignUp && step === 2 && (
                <button type="button" onClick={() => setStep(1)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div>
                <CardTitle className="text-xl font-black">
                  {!isSignUp ? 'Sign In' : step === 1 ? 'Create Account' : 'Carrier Details'}
                </CardTitle>
                <CardDescription>
                  {!isSignUp
                    ? 'Welcome back to the platform'
                    : step === 1
                    ? 'Join the marketplace as a shipper or carrier'
                    : 'Tell us about your truck — not part of verification'}
                </CardDescription>
              </div>
            </div>
            {isSignUp && (
              <div className="flex gap-1 mt-2">
                <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
              </div>
            )}
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.form
                  key="step1"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  onSubmit={handleStep1}
                  className="space-y-4"
                >
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
                      <div className="space-y-2">
                        <Label className="heavy-label">I am a</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setRole('shipper')}
                            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-semibold transition-all ${role === 'shipper' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40'}`}
                          >
                            <Package className="h-6 w-6" />
                            <span>Shipper</span>
                            <span className="text-[10px] font-normal opacity-70">I need to move cargo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRole('driver')}
                            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-semibold transition-all ${role === 'driver' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40'}`}
                          >
                            <Truck className="h-6 w-6" />
                            <span>Carrier</span>
                            <span className="text-[10px] font-normal opacity-70">I have a truck</span>
                          </button>
                        </div>
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
                  <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-black glow-amber" size="lg">
                    {loading ? 'Loading...' : !isSignUp ? (
                      <><LogIn className="mr-2 h-4 w-4" /> Sign In</>
                    ) : role === 'driver' ? (
                      <><ArrowRight className="mr-2 h-4 w-4" /> Continue — Add Truck Details</>
                    ) : (
                      <><UserPlus className="mr-2 h-4 w-4" /> Create Shipper Account</>
                    )}
                  </Button>
                </motion.form>
              )}

              {step === 2 && (
                <motion.form
                  key="step2"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  onSubmit={handleStep2}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="heavy-label">Company / Trading Name</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="e.g. FastFreight Transport Ltd"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="truckType" className="heavy-label">
                      Truck Type <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="truckType"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={truckType}
                      onChange={e => setTruckType(e.target.value)}
                      required
                    >
                      <option value="">Select truck type</option>
                      {TRUCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plateNumber" className="heavy-label">Number Plate</Label>
                    <Input
                      id="plateNumber"
                      value={plateNumber}
                      onChange={e => setPlateNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. AAA 1234"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacityTonnes" className="heavy-label">Payload Capacity (tonnes)</Label>
                    <Input
                      id="capacityTonnes"
                      type="number"
                      min="0"
                      step="0.5"
                      value={capacityTonnes}
                      onChange={e => setCapacityTonnes(e.target.value)}
                      placeholder="e.g. 30"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    These details help shippers find the right carrier. You can update them later in your profile. This is separate from formal verification.
                  </p>
                  <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-black glow-amber" size="lg">
                    {loading ? 'Creating account...' : <><UserPlus className="mr-2 h-4 w-4" /> Create Carrier Account</>}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>

            <button onClick={resetToggles} className="mt-5 block w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
