import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Shield, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EmailChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
  isGoogleAuth: boolean;
  onSuccess: () => void;
}

export function EmailChangeDialog({ 
  open, 
  onOpenChange, 
  currentEmail,
  isGoogleAuth,
  onSuccess 
}: EmailChangeDialogProps) {
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [newEmail, setNewEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  if (isGoogleAuth) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Change Email</DialogTitle>
            <DialogDescription>
              Email addresses for Google authenticated accounts cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your account is authenticated through Google. To change your email, 
              you would need to create a new account with a different email address.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const handleRequestCode = async () => {
    if (!newEmail || newEmail === currentEmail) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a different email address',
        variant: 'destructive',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { type: 'email_change', new_value: newEmail },
      });

      if (error) throw error;

      toast({
        title: 'Verification Code Sent',
        description: 'Check your current email for the verification code',
      });
      setStep('verify');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send verification code',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a 6-digit verification code',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-and-update', {
        body: { code: verificationCode, type: 'email_change' },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Email updated successfully. Please sign in again with your new email.',
      });
      
      // Sign out user so they can sign in with new email
      await supabase.auth.signOut();
      
      onSuccess();
      onOpenChange(false);
      setStep('input');
      setNewEmail('');
      setVerificationCode('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Invalid or expired verification code',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Email Address</DialogTitle>
          <DialogDescription>
            {step === 'input' 
              ? 'Enter your new email address. A verification code will be sent to your current email.'
              : 'Enter the 6-digit verification code sent to your current email.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                After changing your email, you'll need to sign in again with your new email address.
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="current-email">Current Email</Label>
              <Input
                id="current-email"
                value={currentEmail}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="new-email">New Email Address</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value.toLowerCase())}
                placeholder="Enter new email address"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
              <p className="text-sm">
                Verification code sent to: <strong>{currentEmail}</strong>
              </p>
            </div>
            <div>
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl tracking-widest"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('input')}
              className="w-full"
            >
              Back to Email Input
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setStep('input');
              setNewEmail('');
              setVerificationCode('');
            }}
          >
            Cancel
          </Button>
          {step === 'input' ? (
            <Button onClick={handleRequestCode} disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Verification Code'}
            </Button>
          ) : (
            <Button onClick={handleVerify} disabled={isLoading}>
              <Shield className="h-4 w-4 mr-2" />
              {isLoading ? 'Verifying...' : 'Verify & Update'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}