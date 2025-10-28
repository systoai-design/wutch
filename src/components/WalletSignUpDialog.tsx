import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface WalletSignUpDialogProps {
  open: boolean;
  walletAddress: string;
  signature: string;
  message: string;
  onComplete: () => void;
  onCancel: () => void;
}

export const WalletSignUpDialog = ({
  open,
  walletAddress,
  signature,
  message,
  onComplete,
  onCancel,
}: WalletSignUpDialogProps) => {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameError("");
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(usernameToCheck)) {
      setUsernameError("Username must be 3-20 characters and contain only letters, numbers, and underscores");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", usernameToCheck)
      .maybeSingle();

    if (data) {
      setUsernameError("Username is already taken");
    } else {
      setUsernameError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || username.length < 3) {
      setUsernameError("Username is required (minimum 3 characters)");
      return;
    }

    if (usernameError) {
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('register-with-wallet', {
        body: {
          walletAddress,
          signature,
          message,
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
        },
      });

      if (error) {
        toast.error(data?.error || error.message || "Registration failed");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Use the magic link to sign in
      if (data?.session?.properties?.action_link) {
        const token = new URL(data.session.properties.action_link).searchParams.get('token');
        if (token) {
          const { error: signInError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'magiclink',
          });

          if (signInError) {
            console.error('Sign in error:', signInError);
            toast.error('Failed to sign in');
            return;
          }
        }
      }

      toast.success("Account created successfully! Welcome to Wutch!");
      onComplete();
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Registration</DialogTitle>
          <DialogDescription>
            Choose a username to complete your account setup
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wallet">Connected Wallet</Label>
            <Input
              id="wallet"
              value={`${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">
              Username <span className="text-destructive">*</span>
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                checkUsernameAvailability(e.target.value);
              }}
              placeholder="johndoe"
              maxLength={20}
              required
            />
            {usernameError && (
              <p className="text-xs text-destructive">{usernameError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              3-20 characters, letters, numbers, and underscores only
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name (Optional)</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
              maxLength={50}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !!usernameError || !username}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Complete Registration"
              )}
            </Button>
          </div>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          You can add an email address later in your profile settings
        </p>
      </DialogContent>
    </Dialog>
  );
};
