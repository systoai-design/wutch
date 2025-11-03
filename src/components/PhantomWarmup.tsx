import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { detectPhantomWallet } from '@/utils/walletDetection';

/**
 * PhantomWarmup component - pre-selects Phantom on mount to eliminate
 * first-click selection race conditions
 */
export const PhantomWarmup = () => {
  const { wallets, select } = useWallet();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const initializePhantom = async () => {
      // First, verify Phantom is actually installed
      const phantomDetected = await detectPhantomWallet(3000);
      
      if (!phantomDetected) {
        console.log('[PhantomWarmup] Phantom not detected after timeout');
        setIsChecking(false);
        return;
      }

      console.log('[PhantomWarmup] Phantom detected via window.solana');

      // Now wait for wallet adapter to register it
      const maxAttempts = 20; // 5 seconds (20 * 250ms)
      let attempts = 0;

      const waitForAdapter = setInterval(() => {
        const phantomWallet = wallets.find(
          (wallet) => wallet.adapter.name === 'Phantom'
        );

        if (phantomWallet && phantomWallet.adapter.readyState !== WalletReadyState.NotDetected) {
          console.log('[PhantomWarmup] Phantom adapter ready, pre-selecting...');
          clearInterval(waitForAdapter);
          select(phantomWallet.adapter.name);
          setIsChecking(false);
        } else if (attempts >= maxAttempts) {
          console.log('[PhantomWarmup] Phantom adapter not ready after timeout');
          clearInterval(waitForAdapter);
          setIsChecking(false);
        }
        
        attempts++;
      }, 250);
    };

    initializePhantom();
  }, [wallets, select]);

  // Render nothing - this is a silent initialization component
  return null;
};
