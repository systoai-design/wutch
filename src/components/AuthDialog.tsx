import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { MFAVerification } from '@/components/MFAVerification';
import { WalletSignUpDialog } from '@/components/WalletSignUpDialog';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import wutchLogo from '@/assets/wutch-logo.png';
import { useAuthDialog } from '@/store/authDialogStore';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast as sonnerToast } from 'sonner';

const emailSchema = z.string().email('Invalid email address').max(255);
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
const usernameOrEmailSchema = z.string().min(1, 'Email or username is required').max(255);

const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-destructive' };
  if (score <= 3) return { score, label: 'Fair', color: 'bg-warning' };
  if (score <= 4) return { score, label: 'Good', color: 'bg-primary' };
  return { score, label: 'Strong', color: 'bg-success' };
};

export const AuthDialog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isOpen, defaultTab, close } = useAuthDialog();
  const [isLoading, setIsLoading] = useState(false);
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });
  const [showWalletSignUp, setShowWalletSignUp] = useState(false);
  const [walletSignUpData, setWalletSignUpData] = useState<{
    walletAddress: string;
    signature: string;
    message: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  
  const { publicKey, signMessage, connected, disconnect } = useWallet();

  const [loginData, setLoginData] = useState({ emailOrUsername: '', password: '' });
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: ''
  });

  useEffect(() => {
    if (signupData.password) {
      setPasswordStrength(getPasswordStrength(signupData.password));
    } else {
      setPasswordStrength({ score: 0, label: '', color: '' });
    }
  }, [signupData.password]);

  // Close dialog and reset if user is authenticated
  useEffect(() => {
    if (user && isOpen) {
      close();
      setShowMFAVerification(false);
    }
  }, [user, isOpen, close]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      usernameOrEmailSchema.parse(loginData.emailOrUsername);
      passwordSchema.parse(loginData.password);

      let emailToLogin = loginData.emailOrUsername;

      const isEmail = emailSchema.safeParse(loginData.emailOrUsername).success;
      
      if (!isEmail) {
        const { data, error } = await supabase.functions.invoke('get-email-by-username', {
          body: { username: loginData.emailOrUsername }
        });

        if (error || !data?.email) {
          throw new Error('Username not found');
        }

        emailToLogin = data.email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password: loginData.password,
      });

      if (error) throw error;

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasMFA = factors && factors.totp && factors.totp.length > 0;

      if (hasMFA) {
        setShowMFAVerification(true);
        return;
      }

      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
      });

      close();
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = error.message || 'Invalid email, username, or password';
      
      if (error.message?.includes('rate limit')) {
        errorMessage = 'Too many login attempts. Please try again later.';
      } else if (error.message?.includes('Invalid login')) {
        errorMessage = 'Invalid credentials. Please check your email/username and password.';
      }

      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      emailSchema.parse(signupData.email);
      
      const passwordValidation = passwordSchema.safeParse(signupData.password);
      if (!passwordValidation.success) {
        throw new Error(passwordValidation.error.errors[0].message);
      }

      if (!signupData.username.trim()) {
        throw new Error('Username is required');
      }

      const redirectUrl = `${window.location.origin}/app`;

      const { data, error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: signupData.username,
            display_name: signupData.displayName || signupData.username,
          },
        },
      });

      if (error) {
        console.error('Signup error:', error);
        
        if (error.message?.toLowerCase().includes('leaked password')) {
          throw new Error('This password has been found in a data breach. Please choose a different password.');
        } else if (error.message?.toLowerCase().includes('user already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        
        throw new Error(error.message || 'Failed to create account');
      }

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile verification error:', profileError);
          toast({
            title: "Warning",
            description: "Profile verification failed. Please contact support if you experience issues.",
            variant: "destructive",
          });
        } else if (!profile) {
          console.warn('Profile not found after signup - may be created by trigger');
        }
      }

      toast({
        title: 'Account Created!',
        description: 'Please check your email to verify your account.',
      });

      close();
    } catch (error: any) {
      console.error('Signup error:', error);
      let errorMessage = error.message || 'Could not create account';
      
      if (error.message?.includes('leaked password')) {
        errorMessage = 'This password has been compromised in a data breach. Please choose a different password.';
      } else if (error.message?.includes('User already registered')) {
        errorMessage = 'An account with this email already exists. Please log in instead.';
      } else if (error.message?.includes('Password')) {
        errorMessage = error.message;
      }

      toast({
        title: 'Signup Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const isEmbedded = window.self !== window.top;
      
      if (isEmbedded) {
        // When embedded in iframe, use skipBrowserRedirect
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/app`,
            skipBrowserRedirect: true
          }
        });

        if (error) throw error;
        
        // Try multiple methods to navigate when in iframe
        if (data?.url) {
          try {
            // First, try to navigate the top window
            window.top!.location.href = data.url;
          } catch (e) {
            // If blocked, try opening in a new tab
            const newWindow = window.open(data.url, '_blank', 'noopener,noreferrer');
            
            // If popup was blocked, use anchor element as last resort
            if (!newWindow) {
              const anchor = document.createElement('a');
              anchor.href = data.url;
              anchor.target = '_blank';
              anchor.rel = 'noopener noreferrer';
              document.body.appendChild(anchor);
              anchor.click();
              document.body.removeChild(anchor);
            }
          }
        }
      } else {
        // Normal flow when not embedded
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/app`
          }
        });

        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      toast({
        title: 'Login Failed',
        description: error.message || 'Failed to sign in with Google',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  if (showMFAVerification) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-md">
          <MFAVerification
            onVerificationComplete={() => {
              toast({
                title: 'Welcome back!',
                description: 'You have successfully logged in.',
              });
              close();
            }}
            onCancel={() => {
              setShowMFAVerification(false);
              supabase.auth.signOut();
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <img 
              src={wutchLogo} 
              alt="Wutch" 
              className="h-10 w-10"
              width="40"
              height="40"
              loading="eager"
            />
            <DialogTitle className="text-xl">Welcome to Wutch</DialogTitle>
            <p className="text-sm text-muted-foreground">Share streams, earn crypto rewards</p>
          </div>
        </DialogHeader>

        {showWalletSignUp && walletSignUpData && (
          <WalletSignUpDialog
            open={showWalletSignUp}
            walletAddress={walletSignUpData.walletAddress}
            signature={walletSignUpData.signature}
            message={walletSignUpData.message}
            onComplete={() => {
              setShowWalletSignUp(false);
              setWalletSignUpData(null);
              close();
            }}
            onCancel={() => {
              setShowWalletSignUp(false);
              setWalletSignUpData(null);
              if (connected) {
                disconnect();
              }
            }}
          />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email or Username</Label>
                <Input
                  id="login-email"
                  type="text"
                  placeholder="you@example.com or username"
                  value={loginData.emailOrUsername}
                  onChange={(e) => setLoginData({ ...loginData, emailOrUsername: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <Link 
                    to="/reset-password" 
                    className="text-xs text-primary hover:underline"
                    onClick={() => close()}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showLoginPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Log In'}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button 
                type="button" 
                variant="outline" 
                className="w-full" 
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with Google
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-username">Username</Label>
                <Input
                  id="signup-username"
                  type="text"
                  placeholder="cryptoking"
                  value={signupData.username}
                  onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-displayname">Display Name</Label>
                <Input
                  id="signup-displayname"
                  type="text"
                  placeholder="Crypto King"
                  value={signupData.displayName}
                  onChange={(e) => setSignupData({ ...signupData, displayName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showSignupPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                
                {signupData.password && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${passwordStrength.color}`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{passwordStrength.label}</span>
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1">
                        {signupData.password.length >= 8 ? 
                          <CheckCircle2 size={12} className="text-success" /> : 
                          <AlertCircle size={12} className="text-muted-foreground" />
                        }
                        <span className={signupData.password.length >= 8 ? 'text-success' : 'text-muted-foreground'}>
                          At least 8 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/[A-Z]/.test(signupData.password) && /[a-z]/.test(signupData.password) ? 
                          <CheckCircle2 size={12} className="text-success" /> : 
                          <AlertCircle size={12} className="text-muted-foreground" />
                        }
                        <span className={/[A-Z]/.test(signupData.password) && /[a-z]/.test(signupData.password) ? 'text-success' : 'text-muted-foreground'}>
                          Upper & lowercase letters
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/[0-9]/.test(signupData.password) ? 
                          <CheckCircle2 size={12} className="text-success" /> : 
                          <AlertCircle size={12} className="text-muted-foreground" />
                        }
                        <span className={/[0-9]/.test(signupData.password) ? 'text-success' : 'text-muted-foreground'}>
                          At least one number
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/[^A-Za-z0-9]/.test(signupData.password) ? 
                          <CheckCircle2 size={12} className="text-success" /> : 
                          <AlertCircle size={12} className="text-muted-foreground" />
                        }
                        <span className={/[^A-Za-z0-9]/.test(signupData.password) ? 'text-success' : 'text-muted-foreground'}>
                          At least one special character
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button 
                type="button" 
                variant="outline" 
                className="w-full" 
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign up with Google
              </Button>
            </form>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4">
          <div className="text-center space-y-2 py-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 7h-4V5l-2-2h-4L8 5v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-8 10c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-2-12h4v2h-4V5z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Sign Up with Your Wallet</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Phantom wallet to get started - no email required
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={async () => {
              try {
                if (!publicKey || !signMessage) {
                  sonnerToast("Please install Phantom wallet");
                  return;
                }

                setIsLoading(true);

                // Generate message to sign
                const timestamp = Date.now();
                const nonce = crypto.randomUUID();
                const message = `Sign this message to authenticate with Wutch:\n${timestamp}\n${nonce}`;
                const messageBytes = new TextEncoder().encode(message);

                // Request signature
                const signature = await signMessage(messageBytes);
                const signatureBase58 = btoa(String.fromCharCode(...signature));

                setWalletSignUpData({
                  walletAddress: publicKey.toString(),
                  signature: signatureBase58,
                  message,
                });
                setShowWalletSignUp(true);
              } catch (error: any) {
                console.error('Wallet connection error:', error);
                sonnerToast(error.message || "Failed to connect wallet");
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 7h-4V5l-2-2h-4L8 5v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-8 10c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-2-12h4v2h-4V5z"/>
                </svg>
                Connect Phantom Wallet
              </>
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Benefits
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Why use wallet login?</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✓ No email required to get started</li>
              <li>✓ Secure authentication with your wallet</li>
              <li>✓ Add email later in settings (optional)</li>
              <li>✓ Full access to all features</li>
            </ul>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Already have an account?{" "}
            <button
              onClick={() => setActiveTab("login")}
              className="text-primary hover:underline"
            >
              Log in
            </button>
          </p>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
  );
};
