import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { isMobileDevice } from '@/utils/walletDetection';

/**
 * PhantomWarmup component - pre-selects appropriate wallet adapter on mount
 * Mobile: prioritizes Mobile Wallet Adapter, then Phantom
 * Desktop: prioritizes Phantom
 */
export const PhantomWarmup = () => {
  const { wallets, select } = useWallet();

  useEffect(() => {
    const initializeWallet = () => {
      const maxAttempts = 20; // 5 seconds (20 * 250ms)
      let attempts = 0;
      const mobile = isMobileDevice();

      const waitForAdapter = setInterval(() => {
        // Find available adapters
        const mobileWallet = wallets.find(
          (w) => /mobile wallet adapter/i.test(w.adapter.name) && 
                 w.adapter.readyState !== WalletReadyState.NotDetected
        );
        const phantomWallet = wallets.find(
          (w) => /phantom/i.test(w.adapter.name) && 
                 w.adapter.readyState !== WalletReadyState.NotDetected
        );

        // Select based on environment
        const selectedWallet = mobile 
          ? (mobileWallet || phantomWallet)
          : (phantomWallet || mobileWallet);

        if (selectedWallet) {
          console.log('[PhantomWarmup] Pre-selecting wallet:', selectedWallet.adapter.name);
          clearInterval(waitForAdapter);
          select(selectedWallet.adapter.name);
        } else if (attempts >= maxAttempts) {
          console.log('[PhantomWarmup] No wallet adapter ready after timeout');
          clearInterval(waitForAdapter);
        }
        
        attempts++;
      }, 250);

      return () => clearInterval(waitForAdapter);
    };

    return initializeWallet();
  }, [wallets, select]);

  // Render nothing - this is a silent initialization component
  return null;
};
