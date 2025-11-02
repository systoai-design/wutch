import React, { useState, useRef, useCallback } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface CardData {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

interface CardStackProps {
  cards: CardData[];
  className?: string;
}

export const CardStack: React.FC<CardStackProps> = ({ cards, className }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 100;
  const ROTATION_FACTOR = 0.15;
  const rafRef = useRef<number>();

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStart.current = { x: clientX, y: clientY };
  }, []);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    // Throttle with requestAnimationFrame
    if (rafRef.current) return;
    
    rafRef.current = requestAnimationFrame(() => {
      const deltaX = clientX - dragStart.current.x;
      const deltaY = clientY - dragStart.current.y;
      setDragOffset({ x: deltaX, y: deltaY });
      rafRef.current = undefined;
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    const distance = Math.abs(dragOffset.x);
    
    if (distance > SWIPE_THRESHOLD) {
      // Card dismissed, move to next
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % cards.length);
        setDragOffset({ x: 0, y: 0 });
      }, 200);
    } else {
      // Snap back
      setDragOffset({ x: 0, y: 0 });
    }
  }, [isDragging, dragOffset.x, cards.length]);

  const getCardTransform = (index: number) => {
    const position = index - currentIndex;
    
    if (position < 0) {
      // Already swiped cards
      return {
        transform: `translate3d(${dragOffset.x * 2}px, ${dragOffset.y * 2}px, 0) rotate(${dragOffset.x * ROTATION_FACTOR * 2}deg) scale(0.8)`,
        opacity: 0,
        zIndex: 0,
        pointerEvents: 'none' as const,
        filter: 'blur(0px)',
        boxShadow: 'none',
      };
    }
    
    if (position === 0) {
      // Current/top card - simplified shadow
      const rotation = isDragging ? dragOffset.x * ROTATION_FACTOR : 0;
      return {
        transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotation}deg)`,
        opacity: 1,
        zIndex: cards.length,
        pointerEvents: 'auto' as const,
        boxShadow: '0 12px 32px -8px hsl(var(--primary) / 0.3)',
      };
    }
    
    // Cards in the stack behind - simplified depth
    const stackPosition = Math.min(position, 3);
    const scale = 1 - (stackPosition * 0.06); // Reduced scale change
    const translateY = -(stackPosition * 16); // Reduced offset
    const opacity = 1 - (stackPosition * 0.12);
    
    // Simpler shadow
    const shadowIntensity = 0.12 - (stackPosition * 0.02);
    const boxShadow = `0 ${6 + stackPosition * 3}px ${16 + stackPosition * 6}px -4px hsl(var(--foreground) / ${shadowIntensity})`;
    
    return {
      transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
      opacity,
      zIndex: cards.length - stackPosition,
      pointerEvents: position === 1 ? ('auto' as const) : ('none' as const),
      boxShadow,
    };
  };

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative mx-auto" style={{ height: '480px', maxWidth: '400px' }}>
        {cards.map((card, index) => {
          const style = getCardTransform(index);
          const Icon = card.icon;
          
          return (
            <Card
              key={index}
              ref={index === currentIndex ? cardRef : null}
              className={cn(
                "absolute top-0 left-0 w-full cursor-grab active:cursor-grabbing select-none touch-none",
                "glass-card border-white/20",
                isDragging && index === currentIndex ? "transition-none" : "transition-all duration-300"
              )}
              style={{
                transform: style.transform,
                opacity: style.opacity,
                zIndex: style.zIndex,
                pointerEvents: style.pointerEvents,
                boxShadow: style.boxShadow,
                willChange: isDragging && index === currentIndex ? 'transform' : 'auto',
                contain: 'layout style paint',
              }}
              onMouseDown={(e) => {
                if (index === currentIndex) {
                  handleDragStart(e.clientX, e.clientY);
                }
              }}
              onMouseMove={(e) => {
                if (isDragging && index === currentIndex) {
                  handleDragMove(e.clientX, e.clientY);
                }
              }}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={(e) => {
                if (index === currentIndex) {
                  const touch = e.touches[0];
                  handleDragStart(touch.clientX, touch.clientY);
                }
              }}
              onTouchMove={(e) => {
                if (isDragging && index === currentIndex) {
                  const touch = e.touches[0];
                  handleDragMove(touch.clientX, touch.clientY);
                }
              }}
              onTouchEnd={handleDragEnd}
            >
              <CardContent className="p-8">
                <div className={cn("rounded-2xl bg-gradient-to-br p-4 mb-6 inline-flex", card.color)}>
                  <Icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{card.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Progress Indicator */}
      <div className="flex justify-center gap-2 mt-8">
        {cards.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setCurrentIndex(index);
              setDragOffset({ x: 0, y: 0 });
            }}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              index === currentIndex
                ? "bg-primary w-8"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
            aria-label={`Go to card ${index + 1}`}
          />
        ))}
      </div>
      
      {/* Swipe Hint */}
      {currentIndex === 0 && (
        <p className="text-center text-sm text-muted-foreground mt-4 animate-fade-in">
          👆 Swipe or drag the card
        </p>
      )}
    </div>
  );
};
