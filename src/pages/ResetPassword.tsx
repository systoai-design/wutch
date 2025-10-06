import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { ArrowLeft, Mail } from 'lucide-react';
import wutchLogo from '@/assets/wutch-logo.png';
import { useAuthDialog } from '@/store/authDialogStore';
import { useNavigate } from 'react-router-dom';

const emailSchema = z.string().email('Invalid email address').max(255);

const ResetPassword = () => {
  const { toast } = useToast();
  const { open: openAuthDialog } = useAuthDialog();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate email
      emailSchema.parse(email);

      // Call custom backend function for password reset
      const { error } = await supabase.functions.invoke('request-password-reset', {
        body: { email },
      });

      if (error) {
        if (error.message.includes('rate limit')) {
          throw new Error('Too many requests. Please try again later.');
        }
        console.error('Password reset error:', error);
      }

      setEmailSent(true);
      toast({
        title: 'Check Your Email',
        description: 'If an account exists with this email, you will receive password reset instructions.',
      });
    } catch (error: any) {
      console.error('Reset password error:', error);
      let errorMessage = 'Failed to send reset email';
      
      if (error instanceof z.ZodError) {
        errorMessage = error.errors[0].message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/30">
        <Card className="w-full max-w-md p-8 shadow-lg animate-scale-in text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
            <p className="text-muted-foreground">
              We've sent password reset instructions to <strong>{email}</strong>
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground text-left space-y-2">
              <p>📧 Check your inbox for an email from Wutch</p>
              <p>🔗 Click the reset link in the email</p>
              <p>⏱️ The link expires in 1 hour</p>
              <p className="text-xs pt-2 border-t border-border">
                Didn't receive the email? Check your spam folder or try again.
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setEmailSent(false)}
            >
              Send Another Email
            </Button>

            <Button 
              variant="ghost" 
              className="w-full gap-2"
              onClick={() => {
                navigate('/app');
                openAuthDialog('login');
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/30">
      <Card className="w-full max-w-md p-6 shadow-lg animate-scale-in">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 mb-4 -ml-2"
            onClick={() => {
              navigate('/app');
              openAuthDialog('login');
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Button>
          
          <div className="text-center">
            <img 
              src={wutchLogo} 
              alt="Wutch" 
              className="h-12 w-12 mx-auto mb-4"
              width="48"
              height="48"
              loading="eager"
            />
            <h1 className="text-2xl font-bold">Reset Your Password</h1>
            <p className="text-muted-foreground mt-2">
              Enter your email address and we'll send you a link to reset your password
            </p>
          </div>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="transition-all focus:scale-[1.02]"
              autoFocus
            />
          </div>

          <Button 
            type="submit" 
            className="w-full transition-all hover:scale-105" 
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Remember your password?{' '}
            <button 
              onClick={() => {
                navigate('/app');
                openAuthDialog('login');
              }} 
              className="text-primary hover:underline font-medium"
            >
              Log in
            </button>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ResetPassword;
