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
import { Mail, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UsernameChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUsername: string;
  onSuccess: (newUsername: string) => void;
}

export function UsernameChangeDialog({ 
  open, 
  onOpenChange, 
  currentUsername,
  onSuccess 
}: UsernameChangeDialogProps) {
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [newUsername, setNewUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRequestCode = async () => {
    if (!newUsername || newUsername === currentUsername) {
      toast({
        title: 'Invalid Username',
        description: 'Please enter a different username',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { type: 'username_change', new_value: newUsername },
      });

      if (error) throw error;

      toast({
        title: 'Verification Code Sent',
        description: 'Check your email for the verification code',
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
        body: { code: verificationCode, type: 'username_change' },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Username updated successfully',
      });
      onSuccess(data.new_username);
      onOpenChange(false);
      setStep('input');
      setNewUsername('');
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
          <DialogTitle>Change Username</DialogTitle>
          <DialogDescription>
            {step === 'input' 
              ? 'Enter your new username. A verification code will be sent to your email.'
              : 'Enter the 6-digit verification code sent to your email.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="current-username">Current Username</Label>
              <Input
                id="current-username"
                value={currentUsername}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="new-username">New Username</Label>
              <Input
                id="new-username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                placeholder="Enter new username"
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground mt-1">
                3-30 characters, letters, numbers, and underscores only
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
              <p className="text-sm">
                Verification code sent to your email
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
              Back to Username Input
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setStep('input');
              setNewUsername('');
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