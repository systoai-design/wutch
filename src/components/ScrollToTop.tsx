import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { throttle } from '@/utils/performanceOptimization';

export const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const toggleVisibility = throttle(() => {
      const scrolled = window.pageYOffset;
      const winHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      
      setIsVisible(scrolled > 300);
      
      // Calculate scroll progress
      const totalScroll = docHeight - winHeight;
      const progress = (scrolled / totalScroll) * 100;
      setScrollProgress(Math.min(progress, 100));
    }, 100);

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <Button
      onClick={scrollToTop}
      className="fixed bottom-[136px] right-4 z-40 rounded-full w-12 h-12 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 lg:bottom-24 animate-slide-in-bottom"
      size="icon"
      aria-label="Scroll to top"
      style={{
        background: `conic-gradient(hsl(var(--primary)) ${scrollProgress}%, hsl(var(--muted)) ${scrollProgress}%)`,
      }}
    >
      <div className="absolute inset-[2px] rounded-full bg-background flex items-center justify-center">
        <ArrowUp className="h-5 w-5 text-primary" />
      </div>
    </Button>
  );
};
