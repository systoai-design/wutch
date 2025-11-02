import { useEffect, useRef, useState } from 'react';

interface BatchScrollAnimationOptions {
  elements: string[];
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export const useBatchScrollAnimation = (options: BatchScrollAnimationOptions) => {
  const {
    elements,
    threshold = 0.2,
    rootMargin = '200px',
    triggerOnce = true,
  } = options;

  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(() =>
    elements.reduce((acc, el) => ({ ...acc, [el]: false }), {})
  );
  
  const refsMap = useRef<Record<string, HTMLElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const updates: Record<string, boolean> = {};
        
        entries.forEach((entry) => {
          const elementId = entry.target.getAttribute('data-scroll-id');
          if (!elementId) return;

          if (entry.isIntersecting) {
            updates[elementId] = true;
            if (triggerOnce) {
              observer.unobserve(entry.target);
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

    observerRef.current = observer;

    // Observe all registered elements
    Object.values(refsMap.current).forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce]);

  const registerRef = (elementId: string) => (node: HTMLElement | null) => {
    if (node) {
      node.setAttribute('data-scroll-id', elementId);
      refsMap.current[elementId] = node;
      observerRef.current?.observe(node);
    } else {
      const existingNode = refsMap.current[elementId];
      if (existingNode) {
        observerRef.current?.unobserve(existingNode);
        delete refsMap.current[elementId];
      }
    }
  };

  return {
    registerRef,
    visibilityMap,
  };
};
