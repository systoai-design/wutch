import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, Upload } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface VerificationRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verificationType: 'blue' | 'red';
}

export function VerificationRequestDialog({
  open,
  onOpenChange,
  verificationType,
}: VerificationRequestDialogProps) {
  const { user, session } = useAuth();
  const { isAdmin } = useAdmin();
  const wallet = useWallet();
  const publicKey = wallet?.publicKey;
  const sendTransaction = wallet?.sendTransaction;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState<any>(null);

  // Form data
  const [legalName, setLegalName] = useState('');
  const [legalEmail, setLegalEmail] = useState('');
  const [legalPhone, setLegalPhone] = useState('');
  const [legalAddress, setLegalAddress] = useState('');
  const [legalIdType, setLegalIdType] = useState('');
  const [legalIdNumber, setLegalIdNumber] = useState('');
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [paymentSignature, setPaymentSignature] = useState('');

  const PLATFORM_WALLET = '899PTTcBgFauWKL2jyjtuJTyWTuQAEBqyY8bPsPvCH1G';
  const REQUIRED_AMOUNT = 0.05;

  useEffect(() => {
    if (open && verificationType === 'red') {
      checkEligibility();
    }
  }, [open, verificationType]);

  const checkEligibility = async () => {
    if (!user) return;

    if (!session?.access_token) {
      toast.error('Your session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      // Using edge function call instead of direct RPC
      const { data, error } = await supabase.functions.invoke('check-eligibility', {
        body: { userId: user.id },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (error) throw error;
      setEligibility(data);

      if (!data?.eligible) {
        toast.error('Not Eligible', {
          description: `You need ${data?.required_watch_hours} watch hours and ${data?.required_followers} followers. You currently have ${data?.total_watch_hours?.toFixed(1)} hours and ${data?.follower_count} followers.`,
        });
      }
    } catch (error: any) {
      console.error('Error checking eligibility:', error);
      toast.error('Failed to check eligibility', {
        description: error.message || 'Please try again'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(PLATFORM_WALLET),
          lamports: REQUIRED_AMOUNT * LAMPORTS_PER_SOL,
        })
      );

      const {
        context: { slot: minContextSlot },
        value: { blockhash, lastValidBlockHeight }
      } = await connection.getLatestBlockhashAndContext();

      const signature = await sendTransaction(transaction, connection, { minContextSlot });
      
      toast.info('Confirming payment...', { description: 'Please wait while we verify your transaction' });

      await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });

      // Verify payment with edge function
      const { data, error } = await supabase.functions.invoke('verify-badge-payment', {
        body: {
          transactionSignature: signature,
          walletAddress: publicKey.toBase58(),
        },
      });

      if (error) throw error;

      if (data.verified) {
        setPaymentSignature(signature);
        toast.success('Payment verified!');
        setStep(2);
      } else {
        throw new Error('Payment verification failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error('Payment failed', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const uploadIdDocument = async () => {
    if (!idDocument || !user) return null;

    const fileExt = idDocument.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('verification-documents')
      .upload(fileName, idDocument);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('verification-documents')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!session?.access_token) {
      toast.error('Your session expired. Please sign in again.');
      return;
    }

    // Validate required fields
    if (!legalName || !legalEmail || !legalIdType || !legalIdNumber || !idDocument) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (verificationType === 'blue' && !paymentSignature) {
      toast.error('Payment verification required');
      return;
    }

    setLoading(true);
    try {
      // Upload ID document
      const documentUrl = await uploadIdDocument();

      // Submit verification request
      const { error } = await supabase.functions.invoke('submit-verification-request', {
        body: {
          verificationType,
          legalName,
          legalEmail,
          legalPhone,
          legalAddress,
          legalIdType,
          legalIdNumber,
          legalIdDocumentUrl: documentUrl,
          paymentTransactionSignature: paymentSignature,
          paymentWalletAddress: publicKey?.toBase58(),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast.success('Verification request submitted!', {
        description: 'Your request is under review. We\'ll notify you once it\'s processed.',
      });

      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error('Failed to submit request', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminGrantBadge = async () => {
    if (!user || !isAdmin) return;

    if (!session?.access_token) {
      toast.error('Your session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-grant-badge', {
        body: { verificationType },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Admin grant error details:', error);
        throw error;
      }

      toast.success(`${verificationType === 'blue' ? 'Blue' : 'Red'} badge granted!`, {
        description: 'Your badge has been activated. Refresh to see it on your profile.',
      });

      onOpenChange(false);
      resetForm();
      
      // Refresh the page to show the new badge
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      console.error('Admin grant error:', error);
      const description = error.message?.includes('Unauthorized') || error.status === 401
        ? 'Session expired. Please sign out and sign back in.'
        : error.message || 'Please try again';
      toast.error('Failed to grant badge', { description });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setLegalName('');
    setLegalEmail('');
    setLegalPhone('');
    setLegalAddress('');
    setLegalIdType('');
    setLegalIdNumber('');
    setIdDocument(null);
    setPaymentSignature('');
    setEligibility(null);
  };

  const renderBlueFlow = () => {
    // Admins can grant themselves badge directly without forms
    if (isAdmin) {
      return (
        <div className="space-y-4">
          <div className="bg-primary/10 p-4 rounded-lg space-y-3 border border-primary/20">
            <h4 className="font-semibold text-primary">Administrator Access</h4>
            <p className="text-sm text-muted-foreground">
              As a platform administrator, you can instantly grant yourself the blue verification badge without payment or document submission.
            </p>
            <p className="text-xs text-muted-foreground">
              ✓ No payment required<br />
              ✓ No documents needed<br />
              ✓ Instant activation
            </p>
          </div>
          <Button onClick={handleAdminGrantBadge} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Granting Badge...
              </>
            ) : (
              'Grant Blue Badge'
            )}
          </Button>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-semibold">Payment Required</h4>
            <p className="text-sm text-muted-foreground">
              Send exactly <span className="font-bold text-foreground">{REQUIRED_AMOUNT} SOL</span> to receive your blue verification badge.
            </p>
            <p className="text-xs text-muted-foreground break-all">
              Platform Wallet: <code className="bg-background px-1 py-0.5 rounded">{PLATFORM_WALLET}</code>
            </p>
          </div>

          {paymentSignature ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>Payment verified!</span>
            </div>
          ) : (
            <Button onClick={handlePayment} disabled={loading || !publicKey} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                `Pay ${REQUIRED_AMOUNT} SOL`
              )}
            </Button>
          )}
        </div>
      );
    }

    return renderLegalInfoForm();
  };

  const renderRedFlow = () => {
    // Admins can grant themselves badge directly without eligibility checks
    if (isAdmin) {
      return (
        <div className="space-y-4">
          <div className="bg-primary/10 p-4 rounded-lg space-y-3 border border-primary/20">
            <h4 className="font-semibold text-primary">Administrator Access</h4>
            <p className="text-sm text-muted-foreground">
              As a platform administrator, you can instantly grant yourself the red verification badge without meeting eligibility requirements or document submission.
            </p>
            <p className="text-xs text-muted-foreground">
              ✓ No eligibility checks required<br />
              ✓ No documents needed<br />
              ✓ Instant activation
            </p>
          </div>
          <Button onClick={handleAdminGrantBadge} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Granting Badge...
              </>
            ) : (
              'Grant Red Badge'
            )}
          </Button>
        </div>
      );
    }

    if (!eligibility) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (!eligibility.eligible) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span className="font-semibold">Not Eligible Yet</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Watch Hours</span>
                <span>{eligibility.total_watch_hours.toFixed(1)} / {eligibility.required_watch_hours}</span>
              </div>
              <Progress 
                value={(eligibility.total_watch_hours / eligibility.required_watch_hours) * 100} 
              />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Followers</span>
                <span>{eligibility.follower_count} / {eligibility.required_followers}</span>
              </div>
              <Progress 
                value={(eligibility.follower_count / eligibility.required_followers) * 100} 
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Keep creating great content! You'll be eligible for the red badge once you meet the requirements.
          </p>
        </div>
      );
    }

    return renderLegalInfoForm();
  };

  const renderLegalInfoForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="legal-name">Legal Name *</Label>
        <Input
          id="legal-name"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder="Your full legal name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="legal-email">Email Address *</Label>
        <Input
          id="legal-email"
          type="email"
          value={legalEmail}
          onChange={(e) => setLegalEmail(e.target.value)}
          placeholder="your@email.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="legal-phone">Phone Number</Label>
        <Input
          id="legal-phone"
          type="tel"
          value={legalPhone}
          onChange={(e) => setLegalPhone(e.target.value)}
          placeholder="+1 (555) 123-4567"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="legal-address">Address</Label>
        <Textarea
          id="legal-address"
          value={legalAddress}
          onChange={(e) => setLegalAddress(e.target.value)}
          placeholder="Your full address"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="id-type">ID Type *</Label>
        <Select value={legalIdType} onValueChange={setLegalIdType}>
          <SelectTrigger id="id-type">
            <SelectValue placeholder="Select ID type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="passport">Passport</SelectItem>
            <SelectItem value="drivers_license">Driver's License</SelectItem>
            <SelectItem value="national_id">National ID</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="id-number">ID Number *</Label>
        <Input
          id="id-number"
          value={legalIdNumber}
          onChange={(e) => setLegalIdNumber(e.target.value)}
          placeholder="Your ID number"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="id-document">Upload ID Document *</Label>
        <div className="flex items-center gap-2">
          <Input
            id="id-document"
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setIdDocument(e.target.files?.[0] || null)}
          />
          {idDocument && (
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Upload a clear photo or scan of your ID. Accepted formats: JPG, PNG, PDF (max 10MB)
        </p>
      </div>

      <Button onClick={handleSubmit} disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          'Submit Verification Request'
        )}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {verificationType === 'blue' ? 'Blue' : 'Red'} Badge Verification
          </DialogTitle>
          <DialogDescription>
            {verificationType === 'blue' 
              ? 'Get verified by confirming your identity with a one-time payment of 0.05 SOL.'
              : 'Claim your earned verification badge by submitting your information.'
            }
          </DialogDescription>
        </DialogHeader>

        {verificationType === 'blue' ? renderBlueFlow() : renderRedFlow()}

        <p className="text-xs text-muted-foreground text-center">
          🔒 Your information is securely stored and only accessible by platform administrators.
        </p>
      </DialogContent>
    </Dialog>
  );
}
