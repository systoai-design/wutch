import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SplineBackgroundProps {
  className?: string;
}

export const SplineBackground = ({ className = '' }: SplineBackgroundProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setHasError(true);
    }
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    console.warn('Spline viewer failed to load, using fallback');
    setHasError(true);
  };

  // Don't render on mobile for performance
  if (isMobile || hasError) {
    return (
      <div 
        className={`absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5 ${className}`}
        style={{ zIndex: 0 }}
      />
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 ${className}`}
      style={{ zIndex: 0 }}
    >
      {isInView && (
        <>
          <spline-viewer
            url="https://prod.spline.design/Z3mTxPnmbI1ME3Z0/scene.splinecode"
            loading="lazy"
            onLoad={handleLoad}
            onError={handleError}
            style={{
              width: '100%',
              height: '100%',
              opacity: isLoaded ? 0.6 : 0,
              transition: 'opacity 1s ease-in-out',
              willChange: 'opacity',
            }}
          />
          {/* Gradient overlay for better text readability */}
          <div 
            className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/50 to-background/80"
            style={{ zIndex: 1 }}
          />
        </>
      )}
      {/* Loading placeholder */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5 animate-pulse" />
      )}
    </div>
  );
};
