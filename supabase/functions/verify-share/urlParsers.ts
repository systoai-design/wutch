// Shared URL parsers for edge functions
export interface ParsedShareUrl {
  platform_user_id: string | null;
  post_id: string | null;
  isValid: boolean;
  error?: string;
}

export function parseTwitterUrl(url: string): ParsedShareUrl {
  const sanitized = url.trim().replace(/[\u200E\u200F]/g, '').replace(/\/$/, '');
  
  const standardMatch = sanitized.match(/(?:twitter\.com|x\.com)\/([^\/]+)\/status\/(\d+)/);
  if (standardMatch) {
    return { platform_user_id: standardMatch[1], post_id: standardMatch[2], isValid: true };
  }
  
  const shortcutMatch = sanitized.match(/(?:twitter\.com|x\.com)\/i(?:\/web)?\/status\/(\d+)/);
  if (shortcutMatch) {
    return { platform_user_id: null, post_id: shortcutMatch[1], isValid: true };
  }
  
  return { platform_user_id: null, post_id: null, isValid: false, error: 'Invalid Twitter/X URL' };
}

export function parseFacebookUrl(url: string): ParsedShareUrl {
  const sanitized = url.trim().replace(/\/$/, '');
  
  const postMatch = sanitized.match(/(?:facebook\.com|fb\.com)\/([^\/]+)\/posts\/(\d+)/);
  if (postMatch) {
    return { platform_user_id: postMatch[1], post_id: postMatch[2], isValid: true };
  }
  
  const permalinkMatch = sanitized.match(/(?:facebook\.com|fb\.com)\/permalink\.php\?story_fbid=(\d+)/);
  if (permalinkMatch) {
    return { platform_user_id: null, post_id: permalinkMatch[1], isValid: true };
  }
  
  return { platform_user_id: null, post_id: null, isValid: false, error: 'Invalid Facebook URL' };
}

export function parseInstagramUrl(url: string): ParsedShareUrl {
  const sanitized = url.trim().replace(/\/$/, '');
  
  const match = sanitized.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  if (match) {
    return { platform_user_id: null, post_id: match[1], isValid: true };
  }
  
  return { platform_user_id: null, post_id: null, isValid: false, error: 'Invalid Instagram URL' };
}

export function parseTikTokUrl(url: string): ParsedShareUrl {
  const sanitized = url.trim().replace(/\/$/, '');
  
  const fullMatch = sanitized.match(/tiktok\.com\/@([^\/]+)\/video\/(\d+)/);
  if (fullMatch) {
    return { platform_user_id: fullMatch[1], post_id: fullMatch[2], isValid: true };
  }
  
  const shortMatch = sanitized.match(/vm\.tiktok\.com\/([A-Za-z0-9]+)/);
  if (shortMatch) {
    return { platform_user_id: null, post_id: shortMatch[1], isValid: true };
  }
  
  return { platform_user_id: null, post_id: null, isValid: false, error: 'Invalid TikTok URL' };
}

export function parseLinkedInUrl(url: string): ParsedShareUrl {
  const sanitized = url.trim().replace(/\/$/, '');
  
  const match = sanitized.match(/linkedin\.com\/posts\/([^_]+)_activity-(\d+)/);
  if (match) {
    return { platform_user_id: match[1], post_id: match[2], isValid: true };
  }
  
  return { platform_user_id: null, post_id: null, isValid: false, error: 'Invalid LinkedIn URL' };
}

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
