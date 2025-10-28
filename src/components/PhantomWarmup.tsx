import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

/**
 * PhantomWarmup component - pre-selects Phantom on mount to eliminate
 * first-click selection race conditions
 */
export const PhantomWarmup = () => {
  const { wallets, select } = useWallet();

  useEffect(() => {
    // Find Phantom in the wallet list
    const phantomWallet = wallets.find(
      (wallet) => wallet.adapter.name === 'Phantom'
    );

    if (phantomWallet) {
      console.log('[PhantomWarmup] Pre-selecting Phantom wallet');
      // Pre-select Phantom without connecting
      // This eliminates the selection step from the button click
      select(phantomWallet.adapter.name);
    }
  }, [wallets, select]);

  // Render nothing - this is a silent initialization component
  return null;
};
