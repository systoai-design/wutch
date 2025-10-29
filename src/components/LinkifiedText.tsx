import { linkify } from '@/utils/linkify';

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

/**
 * Component that renders text with clickable URLs
 * Preserves whitespace and line breaks
 */
export const LinkifiedText = ({ text, className = '' }: LinkifiedTextProps) => {
  const parts = linkify(text);

  return (
    <span className={`whitespace-pre-wrap ${className}`}>
      {parts.map((part, index) => {
        if (part.type === 'link') {
          return (
            <a
              key={index}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:text-primary/80 underline transition-colors"
            >
              {part.content}
            </a>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </span>
  );
};
