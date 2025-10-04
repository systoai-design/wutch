import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  className?: string;
}

export function TypewriterText({ className = '' }: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const phrases = ['Watch', 'Create', 'Earn'];
  const typingSpeed = 150;
  const deletingSpeed = 100;
  const pauseAfterComplete = 2000;
  const pauseBetweenPhrases = 500;

  useEffect(() => {
    const currentText = phrases[currentPhase];
    
    if (!isDeleting && displayText === currentText) {
      // Finished typing current phrase
      if (currentPhase === phrases.length - 1) {
        // Last phrase - pause longer then restart
        const timeout = setTimeout(() => {
          setIsDeleting(true);
        }, pauseAfterComplete);
        return () => clearTimeout(timeout);
      } else {
        // Move to next phrase
        const timeout = setTimeout(() => {
          setCurrentPhase((prev) => prev + 1);
          setDisplayText('');
        }, pauseBetweenPhrases);
        return () => clearTimeout(timeout);
      }
    }

    if (isDeleting && displayText === '') {
      // Finished deleting all - restart
      setIsDeleting(false);
      setCurrentPhase(0);
      return;
    }

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        setDisplayText(currentText.slice(0, displayText.length + 1));
      } else {
        // Deleting
        setDisplayText(displayText.slice(0, -1));
      }
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, currentPhase, isDeleting]);

  return (
    <span className={className}>
      {currentPhase > 0 && phrases.slice(0, currentPhase).map((phrase, i) => (
        <span key={i}>
          {phrase}
          <span className="text-muted-foreground mx-2">&gt;&gt;</span>
        </span>
      ))}
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
}