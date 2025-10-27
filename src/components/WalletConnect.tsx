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
  const { user, isLoading: authLoading } = useAuth();
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
    setIsConnecting(true);
    try {
      // On mobile, check if we're in Phantom's in-app browser
      const isPhantomInApp = /Phantom/i.test(navigator.userAgent) || (window as any).phantom?.solana?.isPhantom;
      
      // If on mobile and NOT in Phantom app, redirect to open dApp inside Phantom
      if (isMobile && !isPhantomInApp) {
        window.location.assign(`https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`);
        setIsConnecting(false);
        return;
      }
      
      // Select Phantom wallet - works on both mobile and desktop
      // Mobile Wallet Adapter is automatically available via wallet-standard
      const phantomWallet = wallets.find(w => 
        w.adapter.name.toLowerCase().includes('phantom')
      );
      if (phantomWallet) {
        select(phantomWallet.adapter.name);
      }
      
      await connect();
      
      // Wait for publicKey to be populated with retry logic
      let address: string | undefined;
      let retries = 3;
      
      console.log('Waiting for wallet publicKey...');
      while (retries > 0 && !address) {
        if (publicKey) {
          address = publicKey.toBase58();
          console.log('Wallet connected successfully, address:', address);
          break;
        }
        
        // Wait 500ms before checking again
        await new Promise(resolve => setTimeout(resolve, 500));
        retries--;
        console.log(`Retrying... ${retries} attempts left`);
      }
      
      // If still no address, try window.solana as fallback (desktop)
      if (!address && !isMobile) {
        const solana = (window as any)?.solana;
        if (solana?.publicKey) {
          address = solana.publicKey.toString();
          console.log('Retrieved address from window.solana fallback');
        }
      }
      
      if (!address) {
        throw new Error('Failed to retrieve wallet address. Please make sure your wallet is unlocked and try again.');
      }

      // Create message to sign for wallet ownership verification
      const nonce = Math.random().toString(36).substring(2, 15);
      const timestamp = Date.now();
      const message = `Sign this message to verify your wallet: ${timestamp}:${nonce}`;
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

      // Ensure we have a valid session token before verifying
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Please log in again to connect your wallet');
      }

      // Verify signature on backend with fresh token
      const { data, error } = await supabase.functions.invoke('verify-wallet', {
        body: {
          walletAddress: address,
          signature: base58Signature,
          message: message,
        },
      });

      if (error) {
        console.error('Wallet verification error:', error);
        
        // Handle authentication errors specifically
        if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
          // Try to refresh the session and retry once
          const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
          if (refreshedSession) {
            // Retry the verification with refreshed token
            const retryResult = await supabase.functions.invoke('verify-wallet', {
              body: { walletAddress: address, signature: base58Signature, message: message }
            });
            
            if (retryResult.error) {
              throw new Error('Session expired. Please log out and log in again to connect your wallet.');
            }
            if (retryResult.data?.success) {
              // Success on retry
              setWalletAddress(address);
              toast({
                title: "Wallet Connected",
                description: "Your Phantom wallet has been verified and connected successfully.",
              });
              return;
            }
          }
          throw new Error('Session expired. Please log out and log in again to connect your wallet.');
        }
        
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
      
      // Improved error messages
      let errorMessage = error.message || "Failed to connect wallet. Please try again.";
      
      if (error.message?.includes('User rejected') || error.message?.includes('User cancelled')) {
        errorMessage = "Connection cancelled. Please approve the connection in your wallet.";
      } else if (error.message?.includes('not installed') || error.message?.includes('not detected')) {
        errorMessage = "Phantom wallet not detected. Please install the Phantom browser extension.";
      } else if (error.message?.includes('unlock')) {
        errorMessage = "Please unlock your Phantom wallet and try again.";
      } else if (error.message?.includes('Session expired') || error.message?.includes('log in again')) {
        errorMessage = "Your session has expired. Please log out and log in again, then try connecting your wallet.";
      } else if (error.message?.includes('Unauthorized')) {
        errorMessage = "Authentication failed. Please refresh the page and try again.";
      } else if (error.message?.includes('non-2xx') || error.message?.includes('Invalid message format')) {
        errorMessage = "Connection failed. Please make sure your Phantom wallet is unlocked and try again. If the issue persists, refresh the page.";
      }
      
      await disconnect();
      toast({
        title: "Connection Failed",
        description: errorMessage,
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
