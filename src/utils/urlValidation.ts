// Blocked domains for promotional links
const BLOCKED_DOMAINS = [
  // Adult content
  'pornhub.com',
  'xvideos.com',
  'xhamster.com',
  'redtube.com',
  'youporn.com',
  'xnxx.com',
  // Malware/phishing
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  // Add more as needed
];

export function validatePromotionalLink(url: string): { isValid: boolean; error?: string } {
  if (!url || url.trim() === '') {
    return { isValid: true }; // Empty is ok (optional field)
  }

  // Basic URL validation
  try {
    const urlObj = new URL(url);
    
    // Allow both HTTP and HTTPS
    if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
      return { isValid: false, error: 'Only HTTP and HTTPS links are allowed' };
    }

    // Check against blocked domains
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
        return { isValid: false, error: 'This domain is not allowed' };
      }
    }

    // Check for suspicious patterns
    if (hostname.includes('porn') || hostname.includes('xxx')) {
      return { isValid: false, error: 'Inappropriate content is not allowed' };
    }

    // Length check
    if (url.length > 500) {
      return { isValid: false, error: 'URL is too long (max 500 characters)' };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

export function sanitizeUrl(url: string): string {
  if (!url || url.trim() === '') return '';
  
  try {
    const urlObj = new URL(url.trim());
    // Only allow http and https protocols
    if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
      return '';
    }
    return urlObj.toString();
  } catch {
    return '';
  }
}
