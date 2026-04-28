import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  LogIn, UserPlus, Eye, EyeOff, Truck, Package, ArrowLeft, ArrowRight,
  User as UserIcon, Mail, Phone as PhoneIcon, MapPin, Home as HomeIcon, Lock, Globe2,
} from 'lucide-react';
import { toast } from 'sonner';
import HauliqLogo from '@/components/shared/HauliqLogo';
import { motion, AnimatePresence } from 'framer-motion';

const TRUCK_TYPES = [
  'Flatbed', 'Enclosed / Box Body', 'Refrigerated (Reefer)', 'Tanker',
  'Lowbed / Low Loader', 'Tipper / Dump Truck', 'Curtain-side',
  'Container Carrier', 'Car Carrier', 'Livestock Carrier', 'Logging Truck', 'Side Loader',
];

const COUNTRIES = ['Zimbabwe', 'South Africa', 'Zambia', 'Botswana', 'Mozambique', 'Malawi', 'Namibia'];
const CITIES_BY_COUNTRY: Record<string, string[]> = {
  Zimbabwe: ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo', 'Kwekwe', 'Kadoma', 'Chinhoyi', 'Victoria Falls', 'Beitbridge', 'Chitungwiza', 'Marondera', 'Hwange', 'Other'],
  'South Africa': ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein', 'Other'],
  Zambia: ['Lusaka', 'Kitwe', 'Ndola', 'Livingstone', 'Other'],
  Botswana: ['Gaborone', 'Francistown', 'Maun', 'Other'],
  Mozambique: ['Maputo', 'Beira', 'Tete', 'Other'],
  Malawi: ['Lilongwe', 'Blantyre', 'Mzuzu', 'Other'],
  Namibia: ['Windhoek', 'Walvis Bay', 'Other'],
};

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

function PillInput(props: {
  id: string;
  icon: IconType;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
  minLength?: number;
  rightSlot?: React.ReactNode;
  autoComplete?: string;
}) {
  const { id, icon: Icon, type = 'text', value, onChange, placeholder, required, minLength, rightSlot, autoComplete } = props;
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="h-12 w-full rounded-2xl bg-secondary pl-11 pr-12 py-3 text-sm font-medium shadow-soft placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {rightSlot && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
      )}
    </div>
  );
}

function PillSelect(props: {
  id: string;
  icon: IconType;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  required?: boolean;
}) {
  const { id, icon: Icon, value, onChange, options, placeholder, required } = props;
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="h-12 w-full appearance-none rounded-2xl bg-secondary pl-11 pr-9 py-3 text-sm font-medium shadow-soft focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▾</div>
    </div>
  );
}

export default function AuthPage() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Zimbabwe');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [role, setRole] = useState<'shipper' | 'driver'>('shipper');
  const [companyName, setCompanyName] = useState('');
  const [truckType, setTruckType] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [capacityTonnes, setCapacityTonnes] = useState('');

  const [signInTab, setSignInTab] = useState<'email' | 'phone'>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('hauliq_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    // Show error from Google OAuth callback if present in URL
    const urlParams = new URLSearchParams(window.location.search);
    const googleError = urlParams.get('google_error');
    if (googleError) {
      toast.error(`Google sign-in failed: ${googleError}`);
      window.history.replaceState({}, document.title, '/auth');
    }
  }, []);

  if (user) return <Navigate to="/" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signInTab === 'phone') {
      toast.message('Phone sign-in is coming soon — please use email for now.');
      return;
    }
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
  };

  const handleSignUpStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!agreeTerms) {
      toast.error('Please accept the Terms and Privacy Policy');
      return;
    }
    if (role === 'driver') {
      setStep(2);
      return;
    }
    setLoading(true);
    try {
      if (rememberMe) localStorage.setItem('hauliq_email', email);
      else localStorage.removeItem('hauliq_email');
      await (signUp as any)(email, password, fullName, phone, {
        role: 'shipper',
        country,
        city,
        address: address || undefined,
      });
      toast.success('Account created! Welcome to Hauliq.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckType) { toast.error('Please select your truck type'); return; }
    setLoading(true);
    try {
      if (rememberMe) localStorage.setItem('hauliq_email', email);
      else localStorage.removeItem('hauliq_email');
      await (signUp as any)(email, password, fullName, phone, {
        role: 'driver',
        country,
        city,
        address: address || undefined,
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

  const switchMode = () => {
    setIsSignUp(v => !v);
    setStep(1);
    setRole('shipper');
    setCompanyName('');
    setTruckType('');
    setPlateNumber('');
    setCapacityTonnes('');
    setConfirmPassword('');
    setAgreeTerms(false);
  };

  const comingSoon = (label: string) => () => toast.message(`${label} is coming soon`);

  const cityOptions = CITIES_BY_COUNTRY[country] || [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* Brand mark — H fills the orange tile */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary glow-amber p-1.5">
            <HauliqLogo variant="light" size={72} />
          </div>
          <h1 className="font-brand text-3xl text-foreground tracking-tight">HAULIQ</h1>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-card shadow-float p-6 sm:p-7">
          {/* Header */}
          <div className="mb-5 text-center">
            {isSignUp && step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <h2 className="text-2xl font-black tracking-tight">
              {!isSignUp ? 'Login' : step === 1 ? 'Sign Up' : 'Carrier Details'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {!isSignUp
                ? 'Please provide the details below to log in'
                : step === 1
                ? 'Please provide the details below to create your account'
                : 'Tell us about your truck — separate from formal verification'}
            </p>
          </div>

          {isSignUp && (
            <div className="mb-5 flex gap-1">
              <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ---------------- LOGIN ---------------- */}
            {!isSignUp && (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onSubmit={handleSignIn}
                className="space-y-4"
              >
                {/* Email / Phone toggle pill */}
                <div className="rounded-full bg-secondary p-1 grid grid-cols-2 shadow-soft">
                  {(['email', 'phone'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSignInTab(tab)}
                      className={`rounded-full py-2 text-sm font-bold capitalize transition-all ${signInTab === tab ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {signInTab === 'email' ? (
                  <PillInput
                    id="email"
                    icon={Mail}
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="Enter Your Email"
                    required
                    autoComplete="email"
                  />
                ) : (
                  <PillInput
                    id="phone-login"
                    icon={PhoneIcon}
                    type="tel"
                    value={phone}
                    onChange={setPhone}
                    placeholder="+263 77 123 4567"
                    autoComplete="tel"
                  />
                )}

                <PillInput
                  id="password"
                  icon={Lock}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter Your Password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  rightSlot={
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox id="remember" checked={rememberMe} onCheckedChange={c => setRememberMe(c === true)} />
                    <span className="text-sm font-medium text-muted-foreground">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={comingSoon('Password reset')}
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-black glow-amber" size="lg">
                  {loading ? 'Loading...' : <><LogIn className="mr-2 h-4 w-4" /> Log In</>}
                </Button>

                <div className="relative pt-2 pb-1">
                  <div className="absolute inset-x-0 top-1/2 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="bg-card px-3 text-xs font-semibold text-muted-foreground">Or Continue With</span></div>
                </div>

                <button
                  type="button"
                  onClick={() => { window.location.href = '/api/auth/google?role=shipper'; }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-sm font-bold shadow-soft hover:bg-muted transition-colors"
                >
                  <GoogleMark /> Continue with Google
                </button>
              </motion.form>
            )}

            {/* ---------------- SIGN UP STEP 1 ---------------- */}
            {isSignUp && step === 1 && (
              <motion.form
                key="signup1"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                onSubmit={handleSignUpStep1}
                className="space-y-3.5"
              >
                <PillInput id="fullName" icon={UserIcon} value={fullName} onChange={setFullName} placeholder="Full Name" required autoComplete="name" />
                <PillInput id="email-signup" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="Email Address" required autoComplete="email" />
                <PillInput id="phone-signup" icon={PhoneIcon} type="tel" value={phone} onChange={setPhone} placeholder="Phone Number" autoComplete="tel" />

                <div className="grid grid-cols-2 gap-3">
                  <PillSelect id="country" icon={Globe2} value={country} onChange={(v) => { setCountry(v); setCity(''); }} options={COUNTRIES} placeholder="Country" required />
                  <PillSelect id="city" icon={MapPin} value={city} onChange={setCity} options={cityOptions} placeholder="City" required />
                </div>

                <PillInput id="address" icon={HomeIcon} value={address} onChange={setAddress} placeholder="Home Address" autoComplete="street-address" />

                <PillInput
                  id="password-signup"
                  icon={Lock}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  placeholder="New Password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  rightSlot={
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <PillInput
                  id="confirm-password"
                  icon={Lock}
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm Password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  rightSlot={
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-muted-foreground hover:text-foreground">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                {/* Role pills */}
                <div className="pt-1">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">I am a</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('shipper')}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-sm font-bold transition-all shadow-soft ${role === 'shipper' ? 'bg-primary/12 text-foreground ring-2 ring-primary' : 'bg-secondary text-muted-foreground hover:bg-muted'}`}
                    >
                      <Package className="h-5 w-5" strokeWidth={1.6} />
                      <span>Shipper</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('driver')}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-sm font-bold transition-all shadow-soft ${role === 'driver' ? 'bg-primary/12 text-foreground ring-2 ring-primary' : 'bg-secondary text-muted-foreground hover:bg-muted'}`}
                    >
                      <Truck className="h-5 w-5" strokeWidth={1.6} />
                      <span>Carrier</span>
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <Checkbox id="terms" checked={agreeTerms} onCheckedChange={c => setAgreeTerms(c === true)} className="mt-0.5" />
                  <span className="text-xs leading-snug text-muted-foreground">
                    I agree with the{' '}
                    <button type="button" onClick={() => navigate('/terms')} className="font-bold text-primary hover:underline">Terms and Conditions</button>
                    {' '}and{' '}
                    <button type="button" onClick={() => navigate('/privacy')} className="font-bold text-primary hover:underline">Privacy Policy</button>
                    {' '}of Hauliq.
                  </span>
                </label>

                <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-black glow-amber" size="lg">
                  {loading ? 'Creating...' : role === 'driver' ? (
                    <><ArrowRight className="mr-2 h-4 w-4" /> Continue — Add Truck Details</>
                  ) : (
                    <><UserPlus className="mr-2 h-4 w-4" /> Create Account</>
                  )}
                </Button>
              </motion.form>
            )}

            {/* ---------------- SIGN UP STEP 2 (Carrier) ---------------- */}
            {isSignUp && step === 2 && (
              <motion.form
                key="signup2"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                onSubmit={handleSignUpStep2}
                className="space-y-3.5"
              >
                <PillInput id="companyName" icon={Truck} value={companyName} onChange={setCompanyName} placeholder="Company / Trading Name (optional)" />
                <PillSelect id="truckType" icon={Truck} value={truckType} onChange={setTruckType} options={TRUCK_TYPES} placeholder="Select truck type" required />
                <PillInput id="plateNumber" icon={MapPin} value={plateNumber} onChange={(v) => setPlateNumber(v.toUpperCase())} placeholder="Number Plate (e.g. AAA 1234)" />
                <PillInput id="capacityTonnes" icon={Package} type="number" value={capacityTonnes} onChange={setCapacityTonnes} placeholder="Payload Capacity (tonnes)" />
                <p className="text-[11px] text-muted-foreground">
                  These details help shippers find the right carrier. You can update them later in your profile. This is separate from formal verification.
                </p>
                <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-black glow-amber" size="lg">
                  {loading ? 'Creating account...' : <><UserPlus className="mr-2 h-4 w-4" /> Create Carrier Account</>}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          <button
            onClick={switchMode}
            className="mt-5 block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSignUp ? (
              <>Have an account? <span className="font-bold text-primary">Sign in</span></>
            ) : (
              <>Don't have an account? <span className="font-bold text-primary">Sign up</span></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C40.7 34.7 44 30 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

