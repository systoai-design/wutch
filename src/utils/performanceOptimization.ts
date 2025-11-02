/**
 * Performance optimization utilities for mobile devices
 */

/**
 * Debounce function to limit function calls
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function to limit function call rate
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Check if device is low-end based on hardware concurrency
 */
export const isLowEndDevice = (): boolean => {
  return navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : false;
};

/**
 * Preload critical resources
 */
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Preload multiple images in parallel
 */
export const preloadImages = (sources: string[]): Promise<void[]> => {
  return Promise.all(sources.map(src => preloadImage(src)));
};

/**
 * Preload a React component (for lazy loaded components)
 */
export const preloadComponent = (componentImport: () => Promise<any>): void => {
  componentImport();
};

/**
 * Get optimal image quality based on connection
 */
export const getOptimalImageQuality = (): number => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      switch (effectiveType) {
        case 'slow-2g':
        case '2g':
          return 50;
        case '3g':
          return 70;
        case '4g':
        default:
          return 85;
      }
    }
  }
  return 85;
};

/**
 * Get optimal video preload strategy based on network
 */
export const getOptimalPreloadStrategy = (): 'none' | 'metadata' | 'auto' => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      switch (effectiveType) {
        case 'slow-2g':
        case '2g':
          return 'none';
        case '3g':
          return 'metadata';
        case '4g':
        default:
          return 'auto';
      }
    }
  }
  return 'metadata';
};

/**
 * Check if connection is slow
 */
export const isSlowConnection = (): boolean => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection) {
      return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
    }
  }
  return false;
};

/**
 * Request idle callback polyfill
 */
export const requestIdleCallback =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? window.requestIdleCallback
    : (callback: IdleRequestCallback) => {
        const start = Date.now();
        return setTimeout(() => {
          callback({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
          });
        }, 1);
      };

/**
 * Smooth scroll to element with offset for sticky headers
 */
export const scrollToSection = (elementId: string, offset: number = 80): void => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const bodyRect = document.body.getBoundingClientRect().top;
  const elementRect = element.getBoundingClientRect().top;
  const elementPosition = elementRect - bodyRect;
  const offsetPosition = elementPosition - offset;

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth'
  });
};

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
