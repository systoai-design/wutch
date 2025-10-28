import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AddEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const getPasswordStrength = (password: string): number => {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength += 25;
  if (password.match(/[0-9]/)) strength += 25;
  if (password.match(/[^a-zA-Z0-9]/)) strength += 25;
  return strength;
};

export const AddEmailDialog = ({ open, onOpenChange, onSuccess }: AddEmailDialogProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("You must be logged in to add an email");
        return;
      }

      const { data, error } = await supabase.functions.invoke('add-email-to-wallet-account', {
        body: { email: email.trim(), password },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Email added successfully! Please check your inbox to verify your email.");
      onSuccess();
      onOpenChange(false);
      setEmail("");
      setPassword("");
    } catch (error: any) {
      console.error('Add email error:', error);
      toast.error(error.message || "Failed to add email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Add Email & Password
          </DialogTitle>
          <DialogDescription>
            Add an email and password to enable traditional login alongside your wallet
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a strong password"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {password && (
              <div className="space-y-1">
                <Progress value={passwordStrength} className="h-1" />
                <p className="text-xs text-muted-foreground">
                  Password strength: {passwordStrength < 50 ? "Weak" : passwordStrength < 75 ? "Good" : "Strong"}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-muted p-3 space-y-1">
            <p className="text-sm font-medium">Benefits:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Log in with email or wallet</li>
              <li>• Recover access if you lose wallet</li>
              <li>• Enhanced account security</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Email"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
