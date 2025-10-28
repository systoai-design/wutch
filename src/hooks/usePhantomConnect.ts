import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const usePhantomConnect = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const isMobile = useIsMobile();
  const { publicKey, connect, disconnect, signMessage, select, wallets } = useWallet();

  const connectPhantomWallet = async (): Promise<string | null> => {
    setIsConnecting(true);
    try {
      // On mobile, check if we're in Phantom's in-app browser
      const isPhantomInApp = /Phantom/i.test(navigator.userAgent) || (window as any).phantom?.solana?.isPhantom;
      
      // If on mobile and NOT in Phantom app, redirect to open dApp inside Phantom
      if (isMobile && !isPhantomInApp) {
        window.location.assign(`https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`);
        setIsConnecting(false);
        return null;
      }
      
      // Select Phantom wallet
      const phantomWallet = wallets.find(w => 
        w.adapter.name.toLowerCase().includes('phantom')
      );
      if (phantomWallet) {
        select(phantomWallet.adapter.name);
      }
      
      await connect();
      
      // Wait for publicKey to be populated with retry logic
      let address: string | undefined;
      let retries = 5;
      
      console.log('Waiting for wallet publicKey...');
      while (retries > 0 && !address) {
        if (publicKey) {
          address = publicKey.toBase58();
          console.log('Wallet connected successfully, address:', address);
          break;
        }
        
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

      // Request signature
      if (signMessage) {
        signature = await signMessage(encodedMessage);
      } else {
        const solana = (window as any)?.solana;
        if (!solana?.signMessage) {
          throw new Error('Wallet does not support message signing');
        }
        const result = await solana.signMessage(encodedMessage, 'utf8');
        signature = result.signature;
      }
      
      // Convert signature to base58
      const bs58 = (await import('bs58')).default;
      const base58Signature = bs58.encode(signature);

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
      
      if (error.message?.includes('User rejected') || error.message?.includes('User cancelled')) {
        errorMessage = "Connection cancelled. Please approve the connection in your wallet.";
      } else if (error.message?.includes('not installed') || error.message?.includes('not detected')) {
        errorMessage = "Phantom wallet not detected. Please install the Phantom browser extension.";
      } else if (error.message?.includes('unlock')) {
        errorMessage = "Please unlock your Phantom wallet and try again.";
      }
      
      await disconnect();
      toast.error(errorMessage);
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
