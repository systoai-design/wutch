import { useEffect, useRef, useState } from 'react';

interface UseBatchScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

interface ElementVisibility {
  [key: string]: boolean;
}

/**
 * Optimized batch scroll animation hook that uses a single IntersectionObserver
 * for multiple elements instead of creating individual observers
 */
export const useBatchScrollAnimation = (
  elementIds: string[],
  options: UseBatchScrollAnimationOptions = {}
) => {
  const {
    threshold = 0.2,
    rootMargin = '0px',
    triggerOnce = true,
  } = options;

  const [visibilityMap, setVisibilityMap] = useState<ElementVisibility>(() => {
    // Initialize all elements as not visible
    return elementIds.reduce((acc, id) => ({ ...acc, [id]: false }), {});
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedElementsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Create single observer for all elements
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const updates: ElementVisibility = {};
        
        entries.forEach((entry) => {
          const elementId = entry.target.id;
          
          if (entry.isIntersecting) {
            updates[elementId] = true;
            
            if (triggerOnce) {
              observerRef.current?.unobserve(entry.target);
              observedElementsRef.current.delete(elementId);
            }
          } else if (!triggerOnce) {
            updates[elementId] = false;
          }
        });

        if (Object.keys(updates).length > 0) {
          setVisibilityMap((prev) => ({ ...prev, ...updates }));
        }
      },
      { threshold, rootMargin }
    );

    // Observe all elements
    const elementsToObserve: HTMLElement[] = [];
    elementIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element && !observedElementsRef.current.has(id)) {
        elementsToObserve.push(element);
        observedElementsRef.current.add(id);
      }
    });

    elementsToObserve.forEach((element) => {
      observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
      observedElementsRef.current.clear();
    };
  }, [elementIds.join(','), threshold, rootMargin, triggerOnce]);

  return visibilityMap;
};
