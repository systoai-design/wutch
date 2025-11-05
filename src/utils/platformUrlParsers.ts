// Platform-specific URL parsers for multi-platform share verification

export interface ParsedShareUrl {
  platform_user_id: string | null;
  post_id: string | null;
  isValid: boolean;
  error?: string;
}

/**
 * Parse Twitter/X URL
 * Patterns:
 * - twitter.com/username/status/123456
 * - x.com/username/status/123456
 * - twitter.com/i/web/status/123456 (shortcut)
 */
export function parseTwitterUrl(url: string): ParsedShareUrl {
  const sanitized = url.trim().replace(/[\u200E\u200F]/g, '').replace(/\/$/, '');
  
  // Standard format with username
  const standardMatch = sanitized.match(/(?:twitter\.com|x\.com)\/([^\/]+)\/status\/(\d+)/);
  if (standardMatch) {
    return {
      platform_user_id: standardMatch[1],
      post_id: standardMatch[2],
      isValid: true,
    };
  }
  
  // Shortcut format without username
  const shortcutMatch = sanitized.match(/(?:twitter\.com|x\.com)\/i(?:\/web)?\/status\/(\d+)/);
  if (shortcutMatch) {
    return {
      platform_user_id: null, // Will be filled from connected account
      post_id: shortcutMatch[1],
      isValid: true,
    };
  }
  
  return {
    platform_user_id: null,
    post_id: null,
    isValid: false,
    error: 'Invalid Twitter/X URL format',
  };
}

/**
 * Parse Facebook URL
 * Patterns:
 * - facebook.com/username/posts/123456
 * - facebook.com/permalink.php?story_fbid=123&id=456
 * - fb.com/username/posts/123456
 */
export function parseFacebookUrl(url: string): ParsedShareUrl {
  const sanitized = url.trim().replace(/\/$/, '');
  
  // Standard post format
  const postMatch = sanitized.match(/(?:facebook\.com|fb\.com)\/([^\/]+)\/posts\/(\d+)/);
  if (postMatch) {
    return {
      platform_user_id: postMatch[1],
      post_id: postMatch[2],
      isValid: true,
    };
  }
  
  // Permalink format
  const permalinkMatch = sanitized.match(/(?:facebook\.com|fb\.com)\/permalink\.php\?story_fbid=(\d+)/);
  if (permalinkMatch) {
    return {
      platform_user_id: null, // Username not in URL
      post_id: permalinkMatch[1],
      isValid: true,
    };
  }
  
  return {
    platform_user_id: null,
    post_id: null,
    isValid: false,
    error: 'Invalid Facebook URL format',
  };
}

/**
 * Parse Instagram URL
 * Patterns:
 * - instagram.com/p/ABC123
 * - instagram.com/reel/ABC123
 * Note: Username not in URL, requires connected account
 */
export function parseInstagramUrl(url: string): ParsedShareUrl {
  const sanitized = url.trim().replace(/\/$/, '');
  
  // Post format
  const postMatch = sanitized.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  if (postMatch) {
    return {
      platform_user_id: null, // Username not available in IG URLs
      post_id: postMatch[1],
      isValid: true,
    };
  }
  
  return {
    platform_user_id: null,
    post_id: null,
    isValid: false,
    error: 'Invalid Instagram URL format',
  };
}

/**
 * Parse TikTok URL
 * Patterns:
 * - tiktok.com/@username/video/7123456789
 * - vm.tiktok.com/ABC123 (short link - no username)
 */
export function parseTikTokUrl(url: string): ParsedShareUrl {
  const sanitized = url.trim().replace(/\/$/, '');
  
  // Full format with username
  const fullMatch = sanitized.match(/tiktok\.com\/@([^\/]+)\/video\/(\d+)/);
  if (fullMatch) {
    return {
      platform_user_id: fullMatch[1],
      post_id: fullMatch[2],
      isValid: true,
    };
  }
  
  // Short link format
  const shortMatch = sanitized.match(/vm\.tiktok\.com\/([A-Za-z0-9]+)/);
  if (shortMatch) {
    return {
      platform_user_id: null,
      post_id: shortMatch[1],
      isValid: true,
    };
  }
  
  return {
    platform_user_id: null,
    post_id: null,
    isValid: false,
    error: 'Invalid TikTok URL format',
  };
}

/**
 * Parse LinkedIn URL
 * Patterns:
 * - linkedin.com/posts/username_activity-123456
 */
export function parseLinkedInUrl(url: string): ParsedShareUrl {
  const sanitized = url.trim().replace(/\/$/, '');
  
  const match = sanitized.match(/linkedin\.com\/posts\/([^_]+)_activity-(\d+)/);
  if (match) {
    return {
      platform_user_id: match[1],
      post_id: match[2],
      isValid: true,
    };
  }
  
  return {
    platform_user_id: null,
    post_id: null,
    isValid: false,
    error: 'Invalid LinkedIn URL format',
  };
}

/**
 * Main parser - routes to appropriate platform parser
 */
export function parseShareUrl(url: string, platform: string): ParsedShareUrl {
  switch (platform.toLowerCase()) {
    case 'twitter':
    case 'x':
      return parseTwitterUrl(url);
    case 'facebook':
      return parseFacebookUrl(url);
    case 'instagram':
      return parseInstagramUrl(url);
    case 'tiktok':
      return parseTikTokUrl(url);
    case 'linkedin':
      return parseLinkedInUrl(url);
    default:
      return {
        platform_user_id: null,
        post_id: null,
        isValid: false,
        error: `Unsupported platform: ${platform}`,
      };
  }
}

/**
 * Platform display names
 */
export const PLATFORM_NAMES: Record<string, string> = {
  twitter: 'X/Twitter',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
};

/**
 * Platform share intent URLs
 */
export function getPlatformShareIntent(platform: string, text: string, url: string): string | null {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);
  
  switch (platform.toLowerCase()) {
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case 'instagram':
    case 'tiktok':
      return null; // Mobile app only
    default:
      return null;
  }
}
