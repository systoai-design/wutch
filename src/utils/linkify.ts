/**
 * Linkify utility - Converts URLs in text to clickable links
 */

/**
 * Regex pattern to detect URLs
 * Matches http://, https://, and www. URLs
 */
const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

export interface LinkifiedPart {
  type: 'text' | 'link';
  content: string;
  href?: string;
}

/**
 * Parses text and converts URLs into linkified parts
 * @param text - The text to parse
 * @returns Array of text and link parts
 */
export function linkify(text: string): LinkifiedPart[] {
  if (!text) return [];

  const parts: LinkifiedPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex lastIndex
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      });
    }

    // Add the URL as a link
    const url = match[0];
    const href = url.startsWith('www.') ? `https://${url}` : url;
    
    parts.push({
      type: 'link',
      content: url,
      href,
    });

    lastIndex = match.index + url.length;
  }

  // Add remaining text after last URL
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  return parts;
}
