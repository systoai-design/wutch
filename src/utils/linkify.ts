/**
 * Linkify utility - Converts URLs, hashtags, and mentions in text to structured parts
 */

/**
 * Regex patterns to detect URLs, hashtags, and mentions
 */
const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
const HASHTAG_REGEX = /#[\w]+/g;
const MENTION_REGEX = /@[\w]+/g;

export interface LinkifiedPart {
  type: 'text' | 'link' | 'hashtag' | 'mention';
  content: string;
  href?: string;
}

interface Match {
  type: 'link' | 'hashtag' | 'mention';
  content: string;
  index: number;
  href?: string;
}

/**
 * Parses text and converts URLs into linkified parts (legacy function)
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

/**
 * Enhanced linkify that handles URLs, hashtags, and mentions
 * @param text - The text to parse
 * @returns Array of structured parts
 */
export function linkifyWithHashtags(text: string): LinkifiedPart[] {
  if (!text) return [];

  const matches: Match[] = [];

  // Find all URLs
  URL_REGEX.lastIndex = 0;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = URL_REGEX.exec(text)) !== null) {
    const url = urlMatch[0];
    matches.push({
      type: 'link',
      content: url,
      index: urlMatch.index,
      href: url.startsWith('www.') ? `https://${url}` : url,
    });
  }

  // Find all hashtags
  HASHTAG_REGEX.lastIndex = 0;
  let hashtagMatch: RegExpExecArray | null;
  while ((hashtagMatch = HASHTAG_REGEX.exec(text)) !== null) {
    matches.push({
      type: 'hashtag',
      content: hashtagMatch[0],
      index: hashtagMatch.index,
    });
  }

  // Find all mentions
  MENTION_REGEX.lastIndex = 0;
  let mentionMatch: RegExpExecArray | null;
  while ((mentionMatch = MENTION_REGEX.exec(text)) !== null) {
    matches.push({
      type: 'mention',
      content: mentionMatch[0],
      index: mentionMatch.index,
    });
  }

  // Sort by position
  matches.sort((a, b) => a.index - b.index);

  // Build parts array
  const parts: LinkifiedPart[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      });
    }

    // Add the match
    parts.push({
      type: match.type,
      content: match.content,
      href: match.href,
    });

    lastIndex = match.index + match.content.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  return parts;
}
