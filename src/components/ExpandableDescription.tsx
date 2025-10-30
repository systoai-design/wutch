import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { linkifyWithHashtags } from '@/utils/linkify';

interface ExpandableDescriptionProps {
  text: string;
  maxLines?: number;
  className?: string;
  onHashtagClick?: (hashtag: string) => void;
}

/**
 * Component that renders expandable text with clickable URLs, hashtags, and mentions
 * Features smart truncation, "Show more/less" functionality, and smooth animations
 */
export const ExpandableDescription = ({ 
  text, 
  maxLines = 3, 
  className = '',
  onHashtagClick 
}: ExpandableDescriptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldTruncate, setShouldTruncate] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Detect if text needs truncation
  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseFloat(getComputedStyle(textRef.current).lineHeight);
      const maxHeight = lineHeight * maxLines;
      setShouldTruncate(textRef.current.scrollHeight > maxHeight);
    }
  }, [text, maxLines]);

  const parts = linkifyWithHashtags(text);

  const handleHashtagClick = (hashtag: string) => {
    if (onHashtagClick) {
      onHashtagClick(hashtag);
    } else {
      // Default: navigate to search
      navigate(`/search?q=${encodeURIComponent(hashtag)}`);
    }
  };

  const handleMentionClick = (mention: string) => {
    // Remove @ symbol and navigate to profile
    const username = mention.substring(1);
    navigate(`/profile/${username}`);
  };

  return (
    <div className="relative">
      <div
        ref={textRef}
        className={`whitespace-pre-wrap leading-relaxed transition-all duration-300 ease-in-out ${className}`}
        style={{
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          WebkitLineClamp: isExpanded ? 'unset' : maxLines,
        }}
      >
        {parts.map((part, index) => {
          if (part.type === 'link') {
            return (
              <a
                key={index}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-400 hover:text-blue-300 underline decoration-1 underline-offset-2 transition-colors"
              >
                {part.content}
              </a>
            );
          }
          
          if (part.type === 'hashtag') {
            return (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  handleHashtagClick(part.content);
                }}
                className="text-blue-500 font-semibold hover:text-blue-400 hover:underline transition-colors"
              >
                {part.content}
              </button>
            );
          }
          
          if (part.type === 'mention') {
            return (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMentionClick(part.content);
                }}
                className="text-primary font-medium hover:text-primary/80 hover:underline transition-colors"
              >
                {part.content}
              </button>
            );
          }
          
          return <span key={index}>{part.content}</span>;
        })}
      </div>

      {/* Show more / Show less button */}
      {shouldTruncate && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-white/90 font-semibold text-sm mt-1 inline-flex items-center gap-1 hover:text-white transition-colors"
        >
          {isExpanded ? 'Show less' : 'Show more'}
          <ChevronDown 
            className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </button>
      )}
    </div>
  );
};
