import { useState, useEffect, useRef } from 'react';
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
  const skipNextReload = useRef(false);
  const { toast } = useToast();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { connectPhantomWallet, isConnecting } = usePhantomConnect();

  useEffect(() => {
    const loadWalletData = async () => {
      // Skip reload if we just manually set the wallet during login
      if (skipNextReload.current) {
        console.log('Skipping wallet reload - just logged in manually');
        skipNextReload.current = false;
        return;
      }

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
        console.log('Loading wallet data for user:', user.id);
        
        // Load saved wallet address from profile_wallets
        const { data: walletData, error: walletError } = await supabase
          .from('profile_wallets')
          .select('wallet_address')
          .eq('user_id', user.id)
          .maybeSingle();

        if (walletError) {
          console.error('Error fetching wallet from profile_wallets:', walletError);
          throw walletError;
        }

        if (walletData?.wallet_address) {
          console.log('Wallet address loaded from database:', walletData.wallet_address);
          setWalletAddress(walletData.wallet_address);
        } else {
          console.log('No wallet address found in database for user');
          // Only clear if we haven't just set it manually
          if (!walletAddress) {
            setWalletAddress(null);
          }
        }
      } catch (error) {
        console.error('Error loading wallet data:', error);
        // Don't clear wallet address on error if it's already set
        if (!walletAddress) {
          setWalletAddress(null);
        }
      }
    };

    loadWalletData();
  }, [user]);

  const connectWallet = async () => {
    try {
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
          sonnerToast.info('Existing wallet detected, logging you in...');
          
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

            // Verify we're logged into the correct account
            const { data: authData } = await supabase.auth.getUser();
            if (authData.user && authData.user.id !== walletData.user_id) {
              console.error('User ID mismatch after wallet login', {
                expected: walletData.user_id,
                actual: authData.user.id,
              });
              
              // Sign out the wrong account
              await supabase.auth.signOut();
              
              sonnerToast.error('This wallet is linked to another account. Please try again.');
              return;
            }

            sonnerToast.success('Logged in successfully!');
            // Immediately set wallet address and skip next reload
            setWalletAddress(result.address);
            skipNextReload.current = true;
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
    } catch (error: any) {
      // Handle mobile action required error
      if (error.message === 'MOBILE_ACTION_REQUIRED') {
        const deepLink = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=wutch`;
        
        sonnerToast.info('Opening Phantom app...', {
          description: 'You need the Phantom app to connect your wallet',
          action: {
            label: 'Install Phantom',
            onClick: () => window.open('https://phantom.app/download', '_blank')
          }
        });

        const fallbackTimeout = setTimeout(() => {
          sonnerToast.info('Phantom app not found', {
            description: 'Install Phantom to continue',
            action: {
              label: 'Download',
              onClick: () => window.open('https://phantom.app/download', '_blank')
            }
          });
        }, 2500);
        
        window.location.href = deepLink;
        
        window.addEventListener('blur', () => clearTimeout(fallbackTimeout), { once: true });
        window.addEventListener('pagehide', () => clearTimeout(fallbackTimeout), { once: true });
        return;
      }
      
      // Log other errors for debugging
      console.error('Wallet connection error:', error);
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
