import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePhantomConnect, type WalletConnectionData } from '@/hooks/usePhantomConnect';
import { useIsMobile } from '@/hooks/use-mobile';
import { WalletSignUpDialog } from './WalletSignUpDialog';
import { toast as sonnerToast } from 'sonner';

export const WalletConnect = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showWalletSignUp, setShowWalletSignUp] = useState(false);
  const [walletSignUpData, setWalletSignUpData] = useState<WalletConnectionData | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { toast } = useToast();
  const { user, isLoading: authLoading, signOut } = useAuth();
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
    // If user is authenticated, use the original flow
    if (user) {
      const result = await connectPhantomWallet(true);
      if (typeof result === 'string') {
        setWalletAddress(result);
      }
      return;
    }

    // If user is NOT authenticated, connect wallet without auth requirement
    const result = await connectPhantomWallet(false);
    
    if (!result || typeof result === 'string') {
      return;
    }

    // Check if wallet is already registered
    const { data: walletData } = await supabase
      .from('profile_wallets')
      .select('user_id')
      .eq('wallet_address', result.address)
      .maybeSingle();

    if (walletData) {
      // Wallet is registered, log them in
      try {
        setIsLoggingIn(true);
        const { data, error } = await supabase.functions.invoke('login-with-wallet', {
          body: {
            walletAddress: result.address,
            signature: result.signature,
            message: result.message,
          },
        });

        if (error) {
          sonnerToast.error(error.message || 'Failed to log in with wallet');
          return;
        }

        if (data?.session?.properties?.action_link) {
          const url = new URL(data.session.properties.action_link);
          const tokenHash = url.searchParams.get('token_hash') ?? url.searchParams.get('token');
          
          if (!tokenHash) {
            console.error('No token_hash found in action_link');
            sonnerToast.error('Authentication failed - missing token');
            return;
          }

          const { error: signInError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'magiclink',
          });

          if (signInError) {
            console.error('Sign in error:', signInError);
            sonnerToast.error('Failed to sign in');
            return;
          }

          sonnerToast.success('Logged in successfully!');
          // Immediately set wallet address to avoid second click
          setWalletAddress(result.address);
        }
      } catch (error: any) {
        console.error('Login error:', error);
        sonnerToast.error(error.message || 'Failed to log in');
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      // Wallet is NOT registered, show signup dialog
      setWalletSignUpData(result);
      setShowWalletSignUp(true);
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

        // Log out the user
        await signOut();
      }

      setWalletAddress(null);
      toast({
        title: 'Wallet Disconnected',
        description: 'Your wallet has been disconnected. You have been logged out.',
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
    <>
      <Button
        onClick={connectWallet}
        disabled={isConnecting || authLoading || isLoggingIn}
        size="sm"
        className="gap-2"
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">
          {authLoading ? 'Loading...' : isLoggingIn ? 'Logging in...' : isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </span>
        {isMobile && !isConnecting && !authLoading && !isLoggingIn && (
          <span className="sm:hidden">Connect</span>
        )}
      </Button>

      {showWalletSignUp && walletSignUpData && (
        <WalletSignUpDialog
          open={showWalletSignUp}
          walletAddress={walletSignUpData.address}
          signature={walletSignUpData.signature}
          message={walletSignUpData.message}
          onComplete={() => {
            setShowWalletSignUp(false);
            setWalletSignUpData(null);
          }}
          onCancel={() => {
            setShowWalletSignUp(false);
            setWalletSignUpData(null);
          }}
        />
      )}
    </>
  );
};
