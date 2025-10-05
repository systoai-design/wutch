import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  className?: string;
}

export function TypewriterText({ className = '' }: TypewriterTextProps) {
  const words = ['Watch', 'Create', 'Earn'];
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [displayWord, setDisplayWord] = useState('Earn'); // Start with "Earn" to prevent CLS
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const typingSpeed = 100;
  const deletingSpeed = 50;
  const pauseAfterComplete = 2000;

  // Delay animation start until after page load to prevent CLS
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
      setDisplayWord('');
      setCurrentWordIndex(0);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAnimating) return;

    const currentWord = words[currentWordIndex];

    if (!isDeleting && displayWord === currentWord) {
      // Finished typing current word - pause then start deleting
      const timeout = setTimeout(() => {
        setIsDeleting(true);
      }, pauseAfterComplete);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && displayWord === '') {
      // Finished deleting - move to next word
      setIsDeleting(false);
      setCurrentWordIndex((prev) => (prev + 1) % words.length);
      return;
    }

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        setDisplayWord(currentWord.slice(0, displayWord.length + 1));
      } else {
        // Deleting
        setDisplayWord(displayWord.slice(0, -1));
      }
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayWord, isDeleting, isAnimating, currentWordIndex, words]);

  return (
    <span className={className} style={{ display: 'inline-block', minWidth: '200px', textAlign: 'center' }}>
      <span className="text-primary">{displayWord}</span>
      {isAnimating && <span className="animate-pulse text-foreground" style={{ willChange: 'opacity' }}>|</span>}
    </span>
  );
}