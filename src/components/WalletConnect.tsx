import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePhantomConnect } from '@/hooks/usePhantomConnect';
import { useIsMobile } from '@/hooks/use-mobile';

export const WalletConnect = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { connectPhantomWallet, isConnecting } = usePhantomConnect();

  useEffect(() => {
    const loadWalletData = async () => {
      if (!user) {
        // Clear wallet state when user changes
        setWalletAddress(null);
        
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

      // Wait for session to be fully established
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session available yet, skipping wallet load');
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
      } catch (error) {
        console.error('Error loading wallet data:', error);
      }
    };

    loadWalletData();
  }, [user]);

  const connectWallet = async () => {
    const address = await connectPhantomWallet();
    if (address) {
      setWalletAddress(address);
    }
  };

  const disconnectWallet = async () => {
    try {
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
      toast({
        title: 'Wallet Disconnected',
        description: 'Your wallet has been disconnected.',
      });
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  if (walletAddress) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={disconnectWallet}
        className="gap-2"
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">
          {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
        </span>
      </Button>
    );
  }

  return (
    <Button
      onClick={connectWallet}
      disabled={isConnecting || authLoading || !user}
      size="sm"
      className="gap-2"
    >
      <Wallet className="h-4 w-4" />
      <span className="hidden sm:inline">
        {authLoading ? 'Loading...' : isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </span>
      {isMobile && !isConnecting && !authLoading && (
        <span className="sm:hidden">Connect</span>
      )}
    </Button>
  );
};
