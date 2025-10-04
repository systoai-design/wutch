import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card } from '@/components/ui/card';

export const DonationSettings = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [acceptDonations, setAcceptDonations] = useState(false);
  const [showDonationWarning, setShowDonationWarning] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const loadWalletData = async () => {
      if (!user) return;

      try {
        // Load saved wallet address from profile_wallets
        const { data: walletData } = await supabase
          .from('profile_wallets')
          .select('wallet_address')
          .eq('user_id', user.id)
          .maybeSingle();

        if (walletData?.wallet_address) {
          setWalletAddress(walletData.wallet_address);
        }

        // Load donation setting from profiles
        const { data: profileData } = await supabase
          .from('profiles')
          .select('public_wallet_address')
          .eq('id', user.id)
          .maybeSingle();

        setAcceptDonations(!!profileData?.public_wallet_address);
      } catch (error) {
        console.error('Error loading wallet data:', error);
      }
    };

    loadWalletData();
  }, [user]);

  const handleDonationToggle = (checked: boolean) => {
    if (checked && !acceptDonations) {
      // Show warning dialog when enabling
      setShowDonationWarning(true);
    } else if (!checked) {
      // Directly disable if turning off
      toggleDonations(false);
    }
  };

  const toggleDonations = async (enabled: boolean) => {
    if (!user || !walletAddress) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          public_wallet_address: enabled ? walletAddress : null 
        })
        .eq('id', user.id);

      if (error) throw error;

      setAcceptDonations(enabled);
      toast({
        title: enabled ? 'Donations Enabled' : 'Donations Disabled',
        description: enabled 
          ? 'Your wallet is now public and you can receive donations.'
          : 'Your wallet address is now private.',
      });
    } catch (error) {
      console.error('Error toggling donations:', error);
      toast({
        title: 'Error',
        description: 'Failed to update donation settings.',
        variant: 'destructive',
      });
    }
  };

  const confirmEnableDonations = async () => {
    await toggleDonations(true);
    setShowDonationWarning(false);
  };

  if (!walletAddress) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Donation Settings</h3>
        <p className="text-sm text-muted-foreground">
          Connect a wallet in the navigation bar to enable donation settings.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Donation Settings</h3>
          <p className="text-sm text-muted-foreground">
            Enable donations to receive tips from viewers on your content.
          </p>
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex-1">
            <Label htmlFor="accept-donations" className="cursor-pointer font-medium">
              Accept Donations
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Allow viewers to send you SOL tips
            </p>
          </div>
          <Switch
            id="accept-donations"
            checked={acceptDonations}
            onCheckedChange={handleDonationToggle}
          />
        </div>

        {acceptDonations && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  Your wallet is public
                </p>
                <p className="text-sm text-muted-foreground">
                  Viewers can send you tips. Your wallet address ({walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}) is visible to everyone.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      <AlertDialog open={showDonationWarning} onOpenChange={setShowDonationWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Enable Public Donations?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>
                Enabling donations will make your wallet address <strong>publicly visible</strong> to all users on the platform.
              </p>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">Please be aware:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Your wallet address will be visible on your profile</li>
                  <li>Anyone can see your wallet's transaction history on the blockchain</li>
                  <li>You may receive unsolicited messages or spam</li>
                  <li>Scammers could target public wallet addresses</li>
                </ul>
              </div>
              <p className="text-sm">
                Only enable this if you're comfortable with your wallet being public.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnableDonations}>
              I Understand, Enable Donations
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
