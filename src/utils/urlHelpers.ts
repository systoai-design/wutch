/**
 * URL utility functions for generating SEO-friendly, UTM-style content URLs
 */

export interface ContentWithProfile {
  id: string;
  title: string;
  profiles?: {
    username: string;
  };
}

/**
 * Converts a string to a URL-safe slug
 * @param text - The text to slugify
 * @returns URL-safe slug
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
    .replace(/\-\-+/g, '-')      // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start of text
    .replace(/-+$/, '');         // Trim - from end of text
}

/**
 * Generates SEO-friendly URL for content (streams, videos, shorts)
 * Format: /{contentType}/{username}/{title-slug}/{id}
 * @param contentType - Type of content (stream, wutch, shorts)
 * @param content - Content object with id, title, and profiles
 * @returns SEO-friendly URL path
 */
export function generateContentUrl(
  contentType: 'stream' | 'wutch' | 'shorts',
  content: ContentWithProfile
): string {
  const username = content.profiles?.username || 'user';
  const titleSlug = slugify(content.title);
  
  return `/${contentType}/${username}/${titleSlug}/${content.id}`;
}

/**
 * Parses content URL and extracts the ID
 * Handles both new SEO format and legacy UUID-only format
 * @param pathname - The URL pathname
 * @returns The content ID (UUID)
 */
export function parseContentUrl(pathname: string): string | null {
  // Remove leading/trailing slashes
  const cleanPath = pathname.replace(/^\/|\/$/g, '');
  const parts = cleanPath.split('/');
  
  // New format: /{contentType}/{username}/{title-slug}/{id}
  if (parts.length === 4) {
    return parts[3]; // Return the ID
  }
  
  // Legacy format: /{contentType}/{id}
  if (parts.length === 2) {
    return parts[1]; // Return the ID
  }
  
  return null;
}

/**
 * Checks if a string is a valid UUID
 * @param str - String to check
 * @returns true if valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
