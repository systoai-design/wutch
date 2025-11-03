/**
 * Wallet Detection Utilities
 * Provides robust Phantom wallet detection across all environments
 */

/**
 * Detects if Phantom wallet is installed by checking window.solana or window.phantom.solana
 * Polls for up to timeoutMs to handle async wallet injection
 */
export const detectPhantomWallet = async (timeoutMs: number = 3000): Promise<boolean> => {
  // Check if window.solana or window.phantom.solana exists
  const checkSolana = () => {
    const solana = (window as any)?.solana;
    const phantom = (window as any)?.phantom?.solana;
    return (solana?.isPhantom) || (phantom?.isPhantom);
  };

  // Immediate check
  if (checkSolana()) {
    return true;
  }

  // Poll for wallet injection (some wallets inject asynchronously)
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (checkSolana()) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100); // Check every 100ms
  });
};

/**
 * Gets the Phantom provider object from window.solana or window.phantom.solana
 */
export const getPhantomProvider = () => {
  const solana = (window as any)?.solana;
  const phantom = (window as any)?.phantom?.solana;
  
  if (solana?.isPhantom) return solana;
  if (phantom?.isPhantom) return phantom;
  return null;
};

/**
 * Checks if the current device is a mobile device
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Checks if currently running in Phantom's mobile in-app browser
 */
export const isPhantomMobileApp = (): boolean => {
  // Check user agent
  const isPhantomUA = /Phantom/i.test(navigator.userAgent);
  
  // Check if phantom object exists
  const hasPhantomObject = !!(window as any).phantom?.solana;
  
  // Check if solana.isPhantom is true
  const isPhantomProvider = !!(window as any).solana?.isPhantom;
  
  return isPhantomUA || (hasPhantomObject && isPhantomProvider);
};

/**
 * Checks if mobile browser has Phantom extension installed
 * (Android Chrome/Firefox can have extensions)
 */
export const isMobileBrowserWithExtension = async (): Promise<boolean> => {
  if (!isMobileDevice()) return false;
  if (isPhantomMobileApp()) return false; // In-app browser
  
  // Check if browser has extension support and Phantom is installed
  return await detectPhantomWallet(1000);
};
