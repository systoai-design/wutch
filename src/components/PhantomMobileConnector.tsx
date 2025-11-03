import { useEffect } from 'react';
import { usePhantomConnect } from '@/hooks/usePhantomConnect';
import { useIsMobile } from '@/hooks/use-mobile';
import { isPhantomMobileApp } from '@/utils/walletDetection';

/**
 * PhantomMobileConnector - Automatically connects wallet when returning from Phantom mobile app
 * 
 * This component detects when a user returns from the Phantom connect deep link
 * and automatically triggers the connection flow without requiring a second click.
 */
export const PhantomMobileConnector = () => {
  const { connectPhantomWallet } = usePhantomConnect();
  const isMobile = useIsMobile();
  
  useEffect(() => {
    const autoConnect = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const phantomConnect = urlParams.get('phantom_connect');
      const isPhantomApp = isPhantomMobileApp();
      
      if (isMobile && phantomConnect === 'true' && isPhantomApp) {
        console.log('[PhantomMobileConnector] Auto-connecting after Phantom deep link return');
        
        // Clear URL param
        window.history.replaceState({}, '', window.location.pathname);
        
        // Small delay to ensure Phantom provider is ready
        setTimeout(() => {
          connectPhantomWallet(false);
        }, 500);
      }
    };
    
    autoConnect();
  }, [isMobile, connectPhantomWallet]);
  
  return null;
};
