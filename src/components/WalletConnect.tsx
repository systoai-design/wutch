import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@solana/wallet-adapter-react';

export const WalletConnect = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const wallet = useWallet();
  const { publicKey, connect, disconnect, connecting, connected, select, wallets } = wallet;

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
      const phantomWallet = wallets.find(w => 
        w.adapter.name.toLowerCase().includes('phantom')
      );
      if (phantomWallet) {
        select(phantomWallet.adapter.name);
      }
      await connect();
      
      const address = publicKey?.toBase58() || (window as any)?.solana?.publicKey?.toString();
      
      if (!address) {
        throw new Error('Failed to retrieve wallet address');
      }
      
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
        await disconnect();
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

      if (error) {
        if (error.code === '23505' && error.message.includes('unique_wallet_address')) {
          toast({
            title: "Wallet Already Connected",
            description: "This wallet is already connected to another account. Each wallet can only be linked to one account.",
            variant: "destructive",
          });
          await disconnect();
          return;
        }
        throw error;
      }

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
    </Button>
  );
};
