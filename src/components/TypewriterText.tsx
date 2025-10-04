import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  className?: string;
}

export function TypewriterText({ className = '' }: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fullText = 'Watch, Create & Earn';
  const typingSpeed = 100;
  const deletingSpeed = 50;
  const pauseAfterComplete = 2000;

  useEffect(() => {
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
  }, [displayText, isDeleting]);

  return (
    <span className={className} style={{ display: 'inline-block', minWidth: '550px', textAlign: 'center' }}>
      <span style={{ visibility: displayText ? 'visible' : 'hidden' }}>{displayText}</span>
      <span className="animate-pulse" style={{ willChange: 'opacity' }}>|</span>
    </span>
  );
}