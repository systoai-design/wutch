import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WalletConnectionData {
  address: string;
  signature: string;
  message: string;
}

export const usePhantomConnect = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const isMobile = useIsMobile();
  const { publicKey, connect, disconnect, signMessage, select, wallets, connected } = useWallet();

  const connectPhantomWallet = async (requireAuth: boolean = true): Promise<string | WalletConnectionData | null> => {
    // Debounce: prevent double clicks
    if (isConnecting) {
      console.log('Connection already in progress, ignoring click');
      return null;
    }

    setIsConnecting(true);
    try {
      // Clear any stale window.solana connection if adapter isn't connected
      if (!isMobile && !connected) {
        const solana = (window as any)?.solana;
        if (solana?.isConnected && !publicKey) {
          console.log('Clearing stale window.solana connection');
          try {
            await solana.disconnect();
          } catch (e) {
            console.log('Failed to clear stale connection:', e);
          }
        }
      }

      // Check if we just returned from Phantom connect deep link
      const urlParams = new URLSearchParams(window.location.search);
      const phantomConnectReturn = urlParams.get('phantom_connect') === 'true';
      
      // On mobile, check if we're in Phantom's in-app browser
      const isPhantomInApp = /Phantom/i.test(navigator.userAgent) || (window as any).phantom?.solana?.isPhantom;

      // If we returned from Phantom connect and we're in Phantom app, proceed automatically
      if (isMobile && phantomConnectReturn && isPhantomInApp) {
        console.log('✅ Returned from Phantom connect deep link, proceeding automatically');
        
        // Clear the URL param
        window.history.replaceState({}, '', window.location.pathname);
        
        // Continue to connection logic below
      }

      // Mobile deep link logic - ONLY if:
      // 1. Device is mobile AND
      // 2. NOT in Phantom in-app browser AND
      // 3. Phantom extension is NOT detected in mobile browser
      // 4. NOT returning from a connect deep link
      if (isMobile && !isPhantomInApp && !phantomConnectReturn) {
        // Check if Phantom is available as browser extension on mobile
        const { detectPhantomWallet } = await import('@/utils/walletDetection');
        const hasMobileExtension = await detectPhantomWallet(1000);
        
        if (!hasMobileExtension) {
          console.log('📱 No Phantom extension on mobile browser - user needs to take action');
          setIsConnecting(false);
          
          // Return special status so UI can handle it
          throw new Error('MOBILE_ACTION_REQUIRED');
        } else {
          console.log('✅ Phantom extension detected on mobile browser, proceeding with connection');
        }
      }
      
      // Desktop or mobile with extension - proceed with wallet adapter connection
      console.log('[PhantomConnect] Checking for Phantom wallet adapter...');

      // Wait for Phantom to be detected in window
      const { detectPhantomWallet, getPhantomProvider } = await import('@/utils/walletDetection');
      const phantomAvailable = await detectPhantomWallet(3000);
      if (!phantomAvailable) {
        throw new Error('Phantom wallet not detected. Please install Phantom from phantom.app');
      }

      console.log('[PhantomConnect] window.solana detected, finding adapter...');

      // Find Phantom wallet adapter
      const phantomWallet = wallets.find(w => 
        w.adapter.name.toLowerCase().includes('phantom')
      );

      if (!phantomWallet) {
        // Wallet detected in window but adapter not registered
        console.log('[PhantomConnect] Adapter not found, but window.solana exists');
        throw new Error('Phantom wallet adapter not initialized. Please refresh the page.');
      }

      // Check adapter ready state with timeout
      if (phantomWallet.adapter.readyState === WalletReadyState.NotDetected) {
        console.log('[PhantomConnect] Adapter shows NotDetected, waiting for ready state...');
        
        // Wait up to 3 seconds for adapter to update ready state
        let ready = false;
        for (let i = 0; i < 12; i++) {
          await new Promise(resolve => setTimeout(resolve, 250));
          if (phantomWallet.adapter.readyState !== WalletReadyState.NotDetected) {
            ready = true;
            console.log('[PhantomConnect] Adapter ready state updated:', phantomWallet.adapter.readyState);
            break;
          }
        }
        
        if (!ready) {
          // Even if adapter says NotDetected, if window.solana exists, we can still try
          console.log('[PhantomConnect] Adapter still NotDetected but window.solana exists, proceeding anyway...');
        }
      }

      // Only select if not already selected and connected
      if (!connected) {
        console.log('[PhantomConnect] Selecting Phantom wallet...');
        select(phantomWallet.adapter.name);
        
        // Increased settle time to 150ms for more reliable selection
        console.log('[PhantomConnect] Waiting for selection to settle...');
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Poll for wallet to be ready (up to 2 seconds)
        let ready = false;
        for (let i = 0; i < 8; i++) {
          await new Promise(resolve => setTimeout(resolve, 250));
          const currentWallet = wallets.find(w => w.adapter.name === phantomWallet.adapter.name);
          if (currentWallet && currentWallet.adapter.readyState !== WalletReadyState.NotDetected) {
            ready = true;
            console.log('[PhantomConnect] Phantom is ready');
            break;
          }
        }
        
        if (!ready) {
          throw new Error('Phantom wallet took too long to initialize');
        }
      }
      
      // Connect with retry on race conditions and selection errors
      console.log('[PhantomConnect] Initiating connection...');
      try {
        await connect();
        console.log('[PhantomConnect] Connection successful');
      } catch (connectError: any) {
        // Handle WalletNotSelectedError specifically
        if (connectError.name === 'WalletNotSelectedError' || connectError.message?.includes('WalletNotSelected')) {
          console.log('[PhantomConnect] WalletNotSelectedError - re-selecting and retrying...');
          select(phantomWallet.adapter.name);
          await new Promise(resolve => setTimeout(resolve, 150));
          await connect();
          console.log('[PhantomConnect] Retry connection successful');
        } 
        // Retry once if we hit other race conditions
        else if (connectError.message?.includes('already connecting') || connectError.message?.includes('ready state')) {
          console.log('[PhantomConnect] Race condition detected - retrying...');
          await new Promise(resolve => setTimeout(resolve, 500));
          await connect();
          console.log('[PhantomConnect] Retry connection successful');
        } else {
          throw connectError;
        }
      }

      // Wait for publicKey to propagate after connection
      console.log('[PhantomConnect] Waiting for publicKey to propagate...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Wait for publicKey to be populated with retry logic
      let address: string | undefined;
      let retries = 10;
      
      console.log('[PhantomConnect] Waiting for wallet publicKey...');
      while (retries > 0 && !address) {
        if (publicKey) {
          address = publicKey.toBase58();
          console.log('[PhantomConnect] Wallet connected successfully, address:', address);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        retries--;
        console.log(`[PhantomConnect] Retrying... ${retries} attempts left`);
      }
      
      // If publicKey still not available, try one more connect
      if (!address) {
        console.log('[PhantomConnect] publicKey not available, attempting final connect...');
        await new Promise(resolve => setTimeout(resolve, 250));
        try {
          await connect();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (publicKey) {
            address = publicKey.toBase58();
            console.log('[PhantomConnect] Address obtained after final connect:', address);
          }
        } catch (finalConnectError) {
          console.log('[PhantomConnect] Final connect attempt failed:', finalConnectError);
        }
      }
      
      // If still no address, try window.solana as fallback (desktop)
      if (!address && !isMobile) {
        const solana = (window as any)?.solana;
        if (solana?.publicKey) {
          address = solana.publicKey.toString();
          console.log('[PhantomConnect] Retrieved address from window.solana fallback');
        }
      }
      
      if (!address) {
        throw new Error('Failed to retrieve wallet address. Please make sure your wallet is unlocked and try again.');
      }

      // Create message to sign for wallet ownership verification
      const nonce = crypto.randomUUID();
      const timestamp = Date.now();
      const message = requireAuth 
        ? `Sign this message to verify your wallet: ${timestamp}:${nonce}`
        : `Sign this message to authenticate with Wutch:\n${timestamp}\n${nonce}`;
      console.log('Message to sign:', message);
      
      // Verify message format before proceeding (only for requireAuth flow)
      if (requireAuth) {
        const messagePattern = /^Sign this message to verify your wallet: \d+:[a-f0-9-]+$/;
        if (!messagePattern.test(message)) {
          throw new Error('Invalid message format generated');
        }
      }
      
      const encodedMessage = new TextEncoder().encode(message);

      let signature: Uint8Array;

      // Request signature with retry on transient connection issues
      console.log('[PhantomConnect] Requesting message signature...');
      try {
        if (signMessage) {
          signature = await signMessage(encodedMessage);
          console.log('[PhantomConnect] Signature obtained');
        } else {
          const solana = (window as any)?.solana;
          if (!solana?.signMessage) {
            throw new Error('Wallet does not support message signing');
          }
          const result = await solana.signMessage(encodedMessage, 'utf8');
          signature = result.signature;
          console.log('[PhantomConnect] Signature obtained via window.solana');
        }
      } catch (signError: any) {
        // Retry signature if transient connection issue
        if (signError.message?.includes('not connected') || signError.message?.includes('ready')) {
          console.log('[PhantomConnect] Signature failed due to connection state - reconnecting...');
          await connect();
          await new Promise(resolve => setTimeout(resolve, 150));
          
          if (signMessage) {
            signature = await signMessage(encodedMessage);
          } else {
            const solana = (window as any)?.solana;
            const result = await solana.signMessage(encodedMessage, 'utf8');
            signature = result.signature;
          }
          console.log('[PhantomConnect] Signature obtained on retry');
        } else {
          throw signError;
        }
      }
      
      // Convert signature to base58
      const bs58 = (await import('bs58')).default;
      const base58Signature = bs58.encode(signature);

      // If requireAuth is false, return the connection data without verifying
      if (!requireAuth) {
        return {
          address,
          signature: base58Signature,
          message,
        };
      }

      // Ensure we have a valid session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Please log in again to connect your wallet');
      }

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
        
        // Handle message format errors
        if (error.message?.includes('Invalid message format')) {
          console.error('Message format mismatch. Sent message:', message);
          throw new Error('Wallet verification failed due to message format. Please try again.');
        }
        
        // Handle authentication errors
        if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
          const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
          if (refreshedSession) {
            const retryResult = await supabase.functions.invoke('verify-wallet', {
              body: { walletAddress: address, signature: base58Signature, message: message }
            });
            
            if (retryResult.error) {
              throw new Error('Session expired. Please log out and log in again to connect your wallet.');
            }
            if (retryResult.data?.success) {
              toast.success('Wallet connected successfully!');
              return address;
            }
          }
          throw new Error('Session expired. Please log out and log in again to connect your wallet.');
        }
        
        throw new Error(error.message || 'Failed to verify wallet ownership');
      }

      if (!data?.success) {
        throw new Error('Wallet verification failed');
      }

      toast.success('Wallet connected successfully!');
      return address;
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      
      let errorMessage = error.message || "Failed to connect wallet. Please try again.";
      let errorTitle = "Connection Failed";
      
      if (error.message?.includes('User rejected') || error.message?.includes('User cancelled')) {
        errorMessage = "Connection cancelled. Please approve the connection in your Phantom wallet.";
        errorTitle = "Connection Cancelled";
      } else if (error.message?.includes('not installed') || error.message?.includes('not detected')) {
        // Check one more time if window.solana exists
        const { detectPhantomWallet } = await import('@/utils/walletDetection');
        const phantomDetected = await detectPhantomWallet(1000);
        if (phantomDetected) {
          errorMessage = "Phantom detected but connection failed. Please refresh the page and try again.";
          errorTitle = "Connection Error";
        } else {
          errorMessage = "Phantom wallet not detected. Please install Phantom from phantom.app";
          errorTitle = "Wallet Not Found";
        }
      } else if (error.message?.includes('unlock')) {
        errorMessage = "Please unlock your Phantom wallet and try again.";
        errorTitle = "Wallet Locked";
      }
      
      await disconnect();
      toast.error(errorMessage, { description: errorTitle });
      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  return {
    connectPhantomWallet,
    isConnecting,
  };
};
