/**
 * Utility functions for optimizing images loaded from Supabase Storage
 */

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpg' | 'png';
}

/**
 * Applies Supabase image transformation parameters to a URL
 */
export const optimizeImage = (
  url: string | null | undefined,
  options: ImageTransformOptions = {}
): string => {
  if (!url) return '/placeholder.svg';
  
  // Don't transform placeholder images or external URLs
  if (url.includes('placeholder.svg') || !url.includes('supabase')) {
    return url;
  }

  const params = new URLSearchParams();
  
  if (options.width) params.append('width', options.width.toString());
  if (options.height) params.append('height', options.height.toString());
  if (options.quality) params.append('quality', options.quality.toString());
  if (options.format) params.append('format', options.format);

  const paramString = params.toString();
  return paramString ? `${url}?${paramString}` : url;
};

/**
 * Generates srcSet for responsive images
 */
export const generateSrcSet = (
  url: string | null | undefined,
  widths: number[] = [400, 800, 1200],
  quality: number = 80
): string => {
  if (!url || url.includes('placeholder.svg') || !url.includes('supabase')) {
    return '';
  }

  return widths
    .map(width => `${optimizeImage(url, { width, quality })} ${width}w`)
    .join(', ');
};

/**
 * Preset configurations for common image types
 */
export const imagePresets = {
  thumbnail: { width: 640, quality: 80, format: 'webp' as const },
  thumbnailLarge: { width: 960, quality: 85, format: 'webp' as const },
  avatar: { width: 128, height: 128, quality: 85, format: 'webp' as const },
  avatarSmall: { width: 64, height: 64, quality: 85, format: 'webp' as const },
  hero: { width: 1920, quality: 90, format: 'webp' as const },
};
