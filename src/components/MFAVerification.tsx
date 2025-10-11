import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield } from 'lucide-react';

interface MFAVerificationProps {
  onVerificationComplete: () => void;
  onCancel: () => void;
}

export function MFAVerification({ onVerificationComplete, onCancel }: MFAVerificationProps) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) throw new Error('2FA not set up');

      const challenge = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challenge.error) throw challenge.error;

      // Use rate-limited edge function
      const { data, error } = await supabase.functions.invoke('mfa-verify', {
        body: {
          code: code,
          factorId: totpFactor.id,
          challengeId: challenge.data.id,
        },
      });

      if (error) throw error;
      if (data?.error) {
        setRemainingAttempts(data.remaining_attempts ?? null);
        throw new Error(data.error);
      }

      toast({
        title: 'Verified!',
        description: 'Successfully authenticated',
      });
      onVerificationComplete();
    } catch (error: any) {
      const isRateLimited = error.message?.includes('locked') || error.message?.includes('Too many');
      toast({
        title: isRateLimited ? 'Account Temporarily Locked' : 'Verification Failed',
        description: error.message || 'Invalid code. Please try again.',
        variant: 'destructive',
      });
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-6 animate-scale-in">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Two-Factor Authentication</h2>
      </div>

      <p className="text-muted-foreground">
        Enter the 6-digit code from your authenticator app to continue.
      </p>
      
      {remainingAttempts !== null && remainingAttempts < 5 && (
        <p className="text-sm text-destructive">
          {remainingAttempts} attempts remaining before account lockout
        </p>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mfa-code">Authentication Code</Label>
          <Input
            id="mfa-code"
            type="text"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
            required
            autoFocus
            className="text-center text-2xl tracking-widest"
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={isLoading || code.length !== 6} className="flex-1">
            {isLoading ? 'Verifying...' : 'Verify'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
