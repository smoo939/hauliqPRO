import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Shield, FileText, Camera, Upload, CheckCircle, XCircle,
  AlertTriangle, ChevronRight, Loader2, ArrowLeft, Truck, User
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

type DocType = 'drivers_license' | 'national_id' | 'selfie' | 'registration' | 'insurance' | 'truck_photo';
type VerifStep = 'overview' | 'driver_license' | 'driver_id' | 'driver_selfie' | 'truck_reg' | 'truck_insurance' | 'truck_photo';

const STATUS_CONFIG: Record<string, { icon: React.ElementType; pill: string; label: string }> = {
  pending: { icon: AlertTriangle, pill: 'pill pill-amber', label: 'Pending' },
  processing: { icon: Loader2, pill: 'pill pill-amber', label: 'Processing' },
  verified: { icon: CheckCircle, pill: 'pill pill-success', label: 'Verified' },
  flagged: { icon: XCircle, pill: 'pill pill-danger', label: 'Flagged' },
  rejected: { icon: XCircle, pill: 'pill pill-danger', label: 'Rejected' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={cfg.pill}>
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadDoc(userId: string, docType: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${docType}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('verification-documents').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('verification-documents').getPublicUrl(path);
  return data.publicUrl;
}

async function ocrExtract(docType: DocType, base64: string) {
  const { data, error } = await supabase.functions.invoke('verify-document', {
    body: { action: 'ocr_extract', documentType: docType, imageBase64: base64 },
  });
  if (error) throw new Error(error.message || 'OCR failed');
  return data?.data;
}

interface DocUploadCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  status: string;
  onClick: () => void;
}

function DocUploadCard({ title, description, icon: Icon, status, onClick }: DocUploadCardProps) {
  return (
    <button onClick={onClick} className="w-full text-left">
      <Card className="hover:shadow-float transition-shadow">
        <CardContent className="p-4 flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary shrink-0">
            <Icon className="h-[18px] w-[18px] text-foreground" strokeWidth={1.6} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold tracking-tight">{title}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={status} />
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

interface StepUploadProps {
  title: string;
  instructions: string[];
  docType: DocType;
  accept: string;
  isCamera?: boolean;
  onComplete: (extracted: any, fileUrl: string) => void;
  onBack: () => void;
}

function StepUpload({ title, instructions, docType, accept, isCamera, onComplete, onBack }: StepUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      setPreview(URL.createObjectURL(file));
      const base64 = await fileToBase64(file);
      const [fileUrl, extracted] = await Promise.all([
        uploadDoc(user.id, docType, file),
        ocrExtract(docType, base64),
      ]);
      if (extracted?.valid === false) {
        toast.error(extracted.error || 'Document not recognized. Please upload a clear photo.');
        setPreview(null);
        setUploading(false);
        return;
      }
      toast.success('Document processed successfully!');
      onComplete(extracted, fileUrl);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, [user, docType, onComplete]);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h3 className="text-lg font-semibold">{title}</h3>
      <Card>
        <CardContent className="p-4 space-y-3">
          <ul className="space-y-1.5">
            {instructions.map((inst, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">{i + 1}.</span> {inst}
              </li>
            ))}
          </ul>

          {preview ? (
            <div className="relative rounded-lg overflow-hidden">
              <img src={preview} alt="Preview" className="w-full max-h-48 object-cover rounded-lg" />
              {uploading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Analyzing document with AI...</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
            >
              {isCamera ? (
                <Camera className="h-8 w-8 text-muted-foreground" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {isCamera ? 'Tap to take a selfie' : 'Tap to upload document'}
              </p>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept={accept}
            capture={isCamera ? 'user' : undefined}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />

          {!preview && (
            <Button className="w-full" onClick={() => fileRef.current?.click()}>
              {isCamera ? <Camera className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
              {isCamera ? 'Take Selfie' : 'Upload Document'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerificationCenter({ onBack }: { onBack?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<VerifStep>('overview');
  const [crossMatchLoading, setCrossMatchLoading] = useState(false);

  const { data: driverVerif, isLoading: loadingDV } = useQuery({
    queryKey: ['driver-verification', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('driver_verifications')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: truckVerifs, isLoading: loadingTV } = useQuery({
    queryKey: ['truck-verifications', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('truck_verifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const activeTruck = truckVerifs?.[0];

  const ensureDriverVerif = async () => {
    if (!driverVerif && user) {
      await supabase.from('driver_verifications').insert({ user_id: user.id });
      queryClient.invalidateQueries({ queryKey: ['driver-verification'] });
    }
  };

  const ensureTruckVerif = async () => {
    if (!activeTruck && user) {
      await supabase.from('truck_verifications').insert({ user_id: user.id, truck_label: 'My Truck' });
      queryClient.invalidateQueries({ queryKey: ['truck-verifications'] });
    }
  };

  const handleDriverDocComplete = async (docField: string, urlField: string, extracted: any, fileUrl: string) => {
    if (!user) return;
    await ensureDriverVerif();
    const update: any = { [urlField]: fileUrl, updated_at: new Date().toISOString() };

    if (docField === 'license') {
      update.license_name = extracted.name || null;
      update.license_number = extracted.license_number || null;
      update.license_expiry = extracted.expiry_date || null;
      update.license_status = 'verified';
    } else if (docField === 'id') {
      update.national_id_name = extracted.name || null;
      update.national_id_number = extracted.id_number || null;
      update.id_status = 'verified';
    } else if (docField === 'selfie') {
      update.selfie_match_score = extracted.face_detected ? 0.9 : 0.1;
      update.selfie_status = extracted.face_detected && extracted.liveness_indicators === 'natural' ? 'verified' : 'flagged';
      if (!extracted.face_detected) {
        toast.error('No face detected. Please retake your selfie.');
        return;
      }
      if (extracted.liveness_indicators === 'suspicious' || extracted.liveness_indicators === 'printed_photo') {
        toast.error('Liveness check failed. Please take a real selfie, not a photo of a photo.');
        return;
      }
    }

    await supabase.from('driver_verifications').update(update).eq('user_id', user.id);
    queryClient.invalidateQueries({ queryKey: ['driver-verification'] });
    setStep('overview');
  };

  const handleTruckDocComplete = async (docField: string, urlField: string, extracted: any, fileUrl: string) => {
    if (!user || !activeTruck) return;
    const update: any = { [urlField]: fileUrl, updated_at: new Date().toISOString() };

    if (docField === 'registration') {
      update.registration_number = extracted.plate_number || null;
      update.registration_expiry = extracted.expiry_date || null;
      update.reg_status = 'verified';
    } else if (docField === 'insurance') {
      update.insurance_number = extracted.policy_number || null;
      update.insurance_expiry = extracted.expiry_date || null;
      update.insurance_status = 'verified';
    } else if (docField === 'photo') {
      update.plate_from_photo = extracted.plate_number || null;
      update.photo_status = extracted.plate_visible ? 'verified' : 'flagged';
      if (!extracted.plate_visible) {
        toast.error('Number plate not visible. Please retake with plate clearly visible.');
        return;
      }
    }

    await supabase.from('truck_verifications').update(update).eq('id', activeTruck.id);
    queryClient.invalidateQueries({ queryKey: ['truck-verifications'] });
    setStep('overview');
  };

  const runCrossMatch = async () => {
    setCrossMatchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-document', {
        body: { action: 'cross_match' },
      });
      if (error) throw error;
      if (data.status === 'success') {
        toast.success('Driver verification complete! You can now bid on loads.');
      } else if (data.status === 'manual_review') {
        toast.info('Some checks need manual review. You can request an admin review below.');
      } else {
        toast.error(`Verification issues: ${data.issues?.join('. ')}`);
      }
      queryClient.invalidateQueries({ queryKey: ['driver-verification'] });

      // Also cross-match truck if exists
      if (activeTruck) {
        const { data: td } = await supabase.functions.invoke('verify-document', {
          body: { action: 'cross_match_truck', truckId: activeTruck.id },
        });
        if (td?.status === 'success') {
          toast.success('Truck verification complete!');
        } else if (td?.issues?.length) {
          toast.error(`Truck issues: ${td.issues.join('. ')}`);
        }
        queryClient.invalidateQueries({ queryKey: ['truck-verifications'] });
      }
    } catch (err: any) {
      toast.error(err.message || 'Cross-match failed');
    } finally {
      setCrossMatchLoading(false);
    }
  };

  const requestManualReview = async (entityType: 'driver' | 'truck') => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-document', {
        body: {
          action: 'manual_review',
          entityType,
          entityId: entityType === 'truck' ? activeTruck?.id : undefined,
          notes: 'Automatic verification could not complete. Requesting manual review.',
        },
      });
      if (error) throw error;
      toast.success(data.message || 'Manual review requested.');
      queryClient.invalidateQueries({ queryKey: ['driver-verification'] });
      queryClient.invalidateQueries({ queryKey: ['truck-verifications'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to request manual review');
    }
  };

  // Calculate progress
  const driverSteps = [
    driverVerif?.license_status === 'verified',
    driverVerif?.id_status === 'verified',
    driverVerif?.selfie_status === 'verified',
  ];
  const truckSteps = activeTruck ? [
    activeTruck.reg_status === 'verified',
    activeTruck.insurance_status === 'verified',
    activeTruck.photo_status === 'verified',
  ] : [false, false, false];
  const totalComplete = [...driverSteps, ...truckSteps].filter(Boolean).length;
  const progressPct = Math.round((totalComplete / 6) * 100);

  // Render step views
  if (step === 'driver_license') {
    return (
      <StepUpload
        title="Driver's License"
        instructions={[
          "Take a clear photo of your driver's license",
          "Ensure all text is readable and not blurry",
          "Both front sides should be visible",
          "License must not be expired",
        ]}
        docType="drivers_license"
        accept="image/*"
        onBack={() => setStep('overview')}
        onComplete={(ext, url) => handleDriverDocComplete('license', 'license_url', ext, url)}
      />
    );
  }
  if (step === 'driver_id') {
    return (
      <StepUpload
        title="National ID / Passport"
        instructions={[
          "Upload your national ID card or passport",
          "Name must match your driver's license",
          "Ensure photo and text are clearly visible",
        ]}
        docType="national_id"
        accept="image/*"
        onBack={() => setStep('overview')}
        onComplete={(ext, url) => handleDriverDocComplete('id', 'national_id_url', ext, url)}
      />
    );
  }
  if (step === 'driver_selfie') {
    return (
      <StepUpload
        title="Live Selfie Verification"
        instructions={[
          "Use your front camera to take a live selfie",
          "Face the camera directly with good lighting",
          "Do NOT take a photo of a photo or screen",
          "Remove sunglasses and hats",
        ]}
        docType="selfie"
        accept="image/*"
        isCamera
        onBack={() => setStep('overview')}
        onComplete={(ext, url) => handleDriverDocComplete('selfie', 'selfie_url', ext, url)}
      />
    );
  }
  if (step === 'truck_reg') {
    return (
      <StepUpload
        title="Vehicle Registration"
        instructions={[
          "Upload vehicle registration document",
          "Plate number must be clearly visible",
          "Document must not be expired",
        ]}
        docType="registration"
        accept="image/*"
        onBack={async () => { await ensureTruckVerif(); setStep('overview'); }}
        onComplete={(ext, url) => handleTruckDocComplete('registration', 'registration_url', ext, url)}
      />
    );
  }
  if (step === 'truck_insurance') {
    return (
      <StepUpload
        title="Vehicle Insurance"
        instructions={[
          "Upload current insurance certificate",
          "GIT or comprehensive coverage required",
          "Policy must not be expired",
          "Vehicle plate must appear on the document",
        ]}
        docType="insurance"
        accept="image/*"
        onBack={() => setStep('overview')}
        onComplete={(ext, url) => handleTruckDocComplete('insurance', 'insurance_url', ext, url)}
      />
    );
  }
  if (step === 'truck_photo') {
    return (
      <StepUpload
        title="Truck Photo (with Plate)"
        instructions={[
          "Take a photo showing the full truck",
          "Number plate MUST be clearly visible",
          "Photo should show the vehicle condition",
        ]}
        docType="truck_photo"
        accept="image/*"
        onBack={() => setStep('overview')}
        onComplete={(ext, url) => handleTruckDocComplete('photo', 'truck_photo_url', ext, url)}
      />
    );
  }

  // Overview
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Verification Center</h2>
        {driverVerif?.overall_status === 'verified' && <StatusBadge status="verified" />}
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Verification Progress</span>
            <span className="font-semibold">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {progressPct === 100
              ? 'All documents uploaded. Run verification to complete.'
              : `${totalComplete} of 6 documents verified`}
          </p>
        </CardContent>
      </Card>

      {/* Driver Documents */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2 flex items-center gap-2">
          <User className="h-3.5 w-3.5" /> Driver Documents
        </p>
        <div className="space-y-2">
          <DocUploadCard
            title="Driver's License"
            description={driverVerif?.license_number || 'Upload your valid license'}
            icon={FileText}
            status={driverVerif?.license_status || 'pending'}
            onClick={() => { ensureDriverVerif(); setStep('driver_license'); }}
          />
          <DocUploadCard
            title="National ID / Passport"
            description={driverVerif?.national_id_number || 'Upload your ID document'}
            icon={Shield}
            status={driverVerif?.id_status || 'pending'}
            onClick={() => { ensureDriverVerif(); setStep('driver_id'); }}
          />
          <DocUploadCard
            title="Live Selfie"
            description="Liveness check with front camera"
            icon={Camera}
            status={driverVerif?.selfie_status || 'pending'}
            onClick={() => { ensureDriverVerif(); setStep('driver_selfie'); }}
          />
        </div>
      </div>

      {/* Truck Documents */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2 flex items-center gap-2">
          <Truck className="h-3.5 w-3.5" /> Truck Documents
        </p>
        <div className="space-y-2">
          <DocUploadCard
            title="Vehicle Registration"
            description={activeTruck?.registration_number || 'Upload registration'}
            icon={FileText}
            status={activeTruck?.reg_status || 'pending'}
            onClick={async () => { await ensureTruckVerif(); setStep('truck_reg'); }}
          />
          <DocUploadCard
            title="Insurance Certificate"
            description={activeTruck?.insurance_number || 'Upload insurance'}
            icon={Shield}
            status={activeTruck?.insurance_status || 'pending'}
            onClick={async () => { await ensureTruckVerif(); setStep('truck_insurance'); }}
          />
          <DocUploadCard
            title="Truck Photo (with Plate)"
            description="Show truck and visible plate"
            icon={Camera}
            status={activeTruck?.photo_status || 'pending'}
            onClick={async () => { await ensureTruckVerif(); setStep('truck_photo'); }}
          />
        </div>
      </div>

      {/* Cross-match button */}
      {totalComplete >= 3 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Button
            className="w-full"
            onClick={runCrossMatch}
            disabled={crossMatchLoading}
          >
            {crossMatchLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
            ) : (
              <><Shield className="mr-2 h-4 w-4" /> Run Verification Check</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            AI will cross-match your license, ID, selfie, and truck documents
          </p>
        </motion.div>
      )}

      {/* Rejection/Issues display */}
      {driverVerif?.rejection_reason && driverVerif.overall_status !== 'verified' && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive mb-1">Issues Found</p>
            {driverVerif.rejection_reason.split('; ').map((issue: string, i: number) => (
              <p key={i} className="text-xs text-muted-foreground">• {issue}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Manual Review Fallback */}
      {(driverVerif?.overall_status === 'flagged' || driverVerif?.overall_status === 'manual_review') && !(driverVerif as any)?.manual_review_requested && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">AI verification couldn't confirm your identity?</p>
            <p className="text-xs text-muted-foreground">
              Request a manual review — an admin will check your documents within 24-48 hours.
            </p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => requestManualReview('driver')}>
              Request Manual Review (Driver)
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTruck && (activeTruck.overall_status === 'flagged' || activeTruck.overall_status === 'manual_review') && !(activeTruck as any).manual_review_requested && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Truck verification issues?</p>
            <p className="text-xs text-muted-foreground">
              Request manual review for your truck documents.
            </p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => requestManualReview('truck')}>
              Request Manual Review (Truck)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Manual review pending */}
      {((driverVerif as any)?.manual_review_requested || (activeTruck as any)?.manual_review_requested) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-primary">Manual Review In Progress</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your documents are being reviewed by an admin. You'll be notified once the review is complete (typically 24-48 hours).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
