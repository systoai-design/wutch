import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  rootMargin?: string;
  threshold?: number;
  placeholderClassName?: string;
}

export const LazyImage = ({
  src,
  alt,
  className,
  rootMargin = '50px',
  threshold = 0.01,
  placeholderClassName,
  ...props
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return (
    <img
      ref={imgRef}
      src={isInView ? src : undefined}
      alt={alt}
      className={cn(
        className,
        !isLoaded && isInView && 'animate-pulse',
        !isLoaded && placeholderClassName
      )}
      onLoad={() => setIsLoaded(true)}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
};
