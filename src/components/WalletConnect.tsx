import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const WalletConnect = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // Load saved wallet address from profile
    const loadWalletAddress = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('wallet_address')
        .eq('id', user.id)
        .single();

      if (!error && data?.wallet_address) {
        setWalletAddress(data.wallet_address);
      }
    };

    loadWalletAddress();
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

      // Save wallet address to profile
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ wallet_address: address })
          .eq('id', user.id);

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
        await supabase
          .from('profiles')
          .update({ wallet_address: null })
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
      disabled={isConnecting}
      size="sm"
      className="gap-2"
    >
      <Wallet className="h-4 w-4" />
      <span className="hidden sm:inline">
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </span>
    </Button>
  );
};
