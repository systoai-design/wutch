import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  className?: string;
}

export function TypewriterText({ className = '' }: TypewriterTextProps) {
  const fullText = 'Watch, Create & Earn';
  const [displayText, setDisplayText] = useState(fullText); // Start with full text to prevent CLS
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false); // Control when animation starts

  const typingSpeed = 100;
  const deletingSpeed = 50;
  const pauseAfterComplete = 2000;

  // Delay animation start until after page load to prevent CLS
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
      setDisplayText('');
    }, 1500); // Start animation 1.5s after component mount
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAnimating) return; // Don't animate until flag is set

    if (!isDeleting && displayText === fullText) {
      // Finished typing - pause then start deleting
      const timeout = setTimeout(() => {
        setIsDeleting(true);
      }, pauseAfterComplete);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && displayText === '') {
      // Finished deleting - restart
      setIsDeleting(false);
      return;
    }

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        setDisplayText(fullText.slice(0, displayText.length + 1));
      } else {
        // Deleting
        setDisplayText(displayText.slice(0, -1));
      }
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, isAnimating, fullText]);

  return (
    <span className={className} style={{ display: 'inline-block', minWidth: '550px', textAlign: 'center' }}>
      {displayText}
      {isAnimating && <span className="animate-pulse" style={{ willChange: 'opacity' }}>|</span>}
    </span>
  );
}