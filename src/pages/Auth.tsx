import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { MFAVerification } from '@/components/MFAVerification';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

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

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });

  useEffect(() => {
    document.title = 'Login or Sign Up | Wutch';
  }, []);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      usernameOrEmailSchema.parse(loginData.emailOrUsername);
      passwordSchema.parse(loginData.password);

      let emailToLogin = loginData.emailOrUsername;

      // Check if input is an email or username
      const isEmail = emailSchema.safeParse(loginData.emailOrUsername).success;
      
      if (!isEmail) {
        // It's a username, so we need to look up the email using edge function
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

      // Check if user has MFA enabled
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

      navigate('/app');
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = error.message || 'Invalid email, username, or password';
      
      // Handle specific error cases
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
      
      // Validate password with detailed error messages
      const passwordValidation = passwordSchema.safeParse(signupData.password);
      if (!passwordValidation.success) {
        throw new Error(passwordValidation.error.errors[0].message);
      }

      if (!signupData.username.trim()) {
        throw new Error('Username is required');
      }

      const redirectUrl = `${window.location.origin}/`;

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
        
        // Handle specific error cases with user-friendly messages
        if (error.message?.toLowerCase().includes('leaked password')) {
          throw new Error('This password has been found in a data breach. Please choose a different password.');
        } else if (error.message?.toLowerCase().includes('user already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        
        throw new Error(error.message || 'Failed to create account');
      }

      // Verify profile was created (use maybeSingle to avoid PGRST116 error)
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

      navigate('/app');
    } catch (error: any) {
      console.error('Signup error:', error);
      let errorMessage = error.message || 'Could not create account';
      
      // Handle specific error cases
      if (error.message?.includes('leaked password')) {
        errorMessage = 'This password has been compromised in a data breach. Please choose a different password.';
      } else if (error.message?.includes('User already registered')) {
        errorMessage = 'An account with this email already exists. Please log in instead.';
      } else if (error.message?.includes('Password')) {
        errorMessage = error.message; // Show specific password requirement errors
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

  if (showMFAVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/30">
        <div className="w-full max-w-md">
          <MFAVerification
            onVerificationComplete={() => {
              toast({
                title: 'Welcome back!',
                description: 'You have successfully logged in.',
              });
              navigate('/app');
            }}
            onCancel={() => {
              setShowMFAVerification(false);
              supabase.auth.signOut();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/30">
      <Card className="w-full max-w-md p-6 shadow-lg animate-scale-in">
        <div className="mb-6 text-center">
          <img src="/wutch-logo.png" alt="Wutch" className="h-12 w-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Welcome to Wutch</h1>
          <p className="text-muted-foreground mt-2">Share streams, earn crypto rewards</p>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
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
                  className="transition-all focus:scale-[1.02]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <Link 
                    to="/reset-password" 
                    className="text-xs text-primary hover:underline"
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
                    className="transition-all focus:scale-[1.02] pr-10"
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

              <Button type="submit" className="w-full transition-all hover:scale-105" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Log In'}
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
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;
