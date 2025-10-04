import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Wallet, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const WalletConnect = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [acceptDonations, setAcceptDonations] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // Load saved wallet address and donation preference
    const loadWalletData = async () => {
      if (!user) return;
      
      const { data: walletData } = await supabase
        .from('profile_wallets')
        .select('wallet_address')
        .eq('user_id', user.id)
        .single();

      if (walletData?.wallet_address) {
        setWalletAddress(walletData.wallet_address);
      }

      // Check if user has enabled public donations
      const { data: profileData } = await supabase
        .from('profiles')
        .select('public_wallet_address')
        .eq('id', user.id)
        .single();

      setAcceptDonations(!!profileData?.public_wallet_address);
    };

    loadWalletData();
  }, [user]);

  const connectWallet = async () => {
    setIsConnecting(true);

    try {
      // Check if Phantom wallet is installed
      const { solana } = window as any;

      if (!solana?.isPhantom) {
        toast({
          title: 'Wallet Not Found',
          description: 'Please install Phantom wallet to earn rewards!',
          variant: 'destructive',
        });
        window.open('https://phantom.app/', '_blank');
        return;
      }

      // Connect to Phantom
      const response = await solana.connect();
      const address = response.publicKey.toString();

      // Save wallet address to profile_wallets (private)
      if (user) {
        const { error } = await supabase
          .from('profile_wallets')
          .upsert({ user_id: user.id, wallet_address: address });

        if (error) throw error;
      }

      setWalletAddress(address);
      toast({
        title: 'Wallet Connected!',
        description: 'You can now earn rewards by sharing streams.',
      });
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Could not connect wallet',
        variant: 'destructive',
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

  if (walletAddress) {
    return (
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
            onCheckedChange={toggleDonations}
          />
        </div>
        
        {acceptDonations && (
          <p className="text-xs text-muted-foreground">
            Your wallet is public. Viewers can send you tips on your shorts.
          </p>
        )}
      </div>
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
