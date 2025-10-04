import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Wallet, Info, AlertTriangle } from 'lucide-react';
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

export const WalletConnect = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [acceptDonations, setAcceptDonations] = useState(false);
  const [showDonationWarning, setShowDonationWarning] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const loadWalletData = async () => {
      if (!user) {
        // Clear wallet state when user changes
        setWalletAddress(null);
        setAcceptDonations(false);
        
        // Optionally disconnect Phantom when switching accounts
        const { solana } = window as any;
        if (solana?.isConnected) {
          try {
            await solana.disconnect();
          } catch (error) {
            console.error('Error disconnecting wallet:', error);
          }
        }
        return;
      }

      try {
        // Load saved wallet address from profile_wallets
        const { data: walletData, error: walletError } = await supabase
          .from('profile_wallets')
          .select('wallet_address')
          .eq('user_id', user.id)
          .maybeSingle();

        if (walletError) throw walletError;

        if (walletData?.wallet_address) {
          setWalletAddress(walletData.wallet_address);
        } else {
          setWalletAddress(null);
        }

        // Load donation setting from profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('public_wallet_address')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        setAcceptDonations(!!profileData?.public_wallet_address);
      } catch (error) {
        console.error('Error loading wallet data:', error);
      }
    };

    loadWalletData();
  }, [user]);

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      
      const { solana } = window as any;
      
      if (!solana?.isPhantom) {
        toast({
          title: "Phantom Not Found",
          description: "Please install Phantom wallet extension to continue.",
          variant: "destructive",
        });
        return;
      }

      const response = await solana.connect();
      const address = response.publicKey.toString();
      
      // Check if this wallet is already connected to another account
      const { data: existingWallet, error: checkError } = await supabase
        .from('profile_wallets')
        .select('user_id')
        .eq('wallet_address', address)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing wallet:', checkError);
        throw new Error('Failed to verify wallet availability');
      }

      if (existingWallet && existingWallet.user_id !== user?.id) {
        toast({
          title: "Wallet Already Connected",
          description: "This wallet is already connected to another account. Each wallet can only be linked to one account.",
          variant: "destructive",
        });
        // Disconnect the wallet from Phantom
        await solana.disconnect();
        return;
      }

      // Save wallet address to profile_wallets table (upsert by user_id)
      const { error } = await supabase
        .from('profile_wallets')
        .upsert({
          user_id: user?.id,
          wallet_address: address,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setWalletAddress(address);
      toast({
        title: "Wallet Connected",
        description: "Your Phantom wallet has been connected successfully.",
      });
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      const { solana } = window as any;
      await solana?.disconnect();

      if (user) {
        // Remove from profile_wallets
        await supabase
          .from('profile_wallets')
          .delete()
          .eq('user_id', user.id);

        // Remove public wallet address
        await supabase
          .from('profiles')
          .update({ public_wallet_address: null })
          .eq('id', user.id);
      }

      setWalletAddress(null);
      setAcceptDonations(false);
      toast({
        title: 'Wallet Disconnected',
        description: 'Your wallet has been disconnected.',
      });
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

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

  if (walletAddress) {
    return (
      <>
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={disconnectWallet}
            className="gap-2 w-full"
          >
            <Wallet className="h-4 w-4" />
            <span>
              {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
            </span>
          </Button>
          
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Label htmlFor="accept-donations" className="cursor-pointer text-sm">
                Accept Donations
              </Label>
              <Info className="h-3 w-3 text-muted-foreground" />
            </div>
            <Switch
              id="accept-donations"
              checked={acceptDonations}
              onCheckedChange={handleDonationToggle}
            />
          </div>
          
          {acceptDonations ? (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    Your wallet is public
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Viewers can send you tips. Be aware that your wallet address is visible to everyone.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Enable donations to receive tips from viewers on your content.
            </p>
          )}
        </div>

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
  }

  return (
    <Button
      onClick={connectWallet}
      disabled={isConnecting}
      size="sm"
      className="gap-2 w-full"
    >
      <Wallet className="h-4 w-4" />
      <span>
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </span>
    </Button>
  );
};
