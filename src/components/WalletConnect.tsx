import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@solana/wallet-adapter-react';
import { useIsMobile } from '@/hooks/use-mobile';

export const WalletConnect = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { publicKey, connect, disconnect, signMessage, select, wallets } = useWallet();

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
    setIsConnecting(true);
    try {
      // Select Phantom wallet - works on both mobile and desktop
      // Mobile Wallet Adapter is automatically available via wallet-standard
      const phantomWallet = wallets.find(w => 
        w.adapter.name.toLowerCase().includes('phantom')
      );
      if (phantomWallet) {
        select(phantomWallet.adapter.name);
      }
      
      await connect();
      
      const address = publicKey?.toBase58();
      
      if (!address) {
        throw new Error('Failed to retrieve wallet address');
      }

      // Create message to sign for wallet ownership verification
      const message = `Verify wallet ownership for Wutch\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      const encodedMessage = new TextEncoder().encode(message);

      let signature: Uint8Array;

      // Request signature - works for both mobile and desktop
      if (signMessage) {
        // Use wallet adapter's signMessage (works for mobile and desktop)
        signature = await signMessage(encodedMessage);
      } else {
        // Fallback to window.solana for older desktop implementations
        const solana = (window as any)?.solana;
        if (!solana?.signMessage) {
          throw new Error('Wallet does not support message signing');
        }
        const result = await solana.signMessage(encodedMessage, 'utf8');
        signature = result.signature;
      }
      
      // Convert Uint8Array signature to base58 string using bs58 already in dependencies
      const bs58 = (await import('bs58')).default;
      const base58Signature = bs58.encode(signature);

      // Verify signature on backend
      const { data, error } = await supabase.functions.invoke('verify-wallet', {
        body: {
          walletAddress: address,
          signature: base58Signature,
          message: message,
        },
      });

      if (error) {
        console.error('Wallet verification error:', error);
        throw new Error(error.message || 'Failed to verify wallet ownership');
      }

      if (!data?.success) {
        throw new Error('Wallet verification failed');
      }

      setWalletAddress(address);
      toast({
        title: "Wallet Connected",
        description: "Your Phantom wallet has been verified and connected successfully.",
      });
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      await disconnect();
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
      await disconnect();

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
      disabled={isConnecting}
      size="sm"
      className="gap-2"
    >
      <Wallet className="h-4 w-4" />
      <span className="hidden sm:inline">
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </span>
      {isMobile && !isConnecting && (
        <span className="sm:hidden">Connect</span>
      )}
    </Button>
  );
};
