// Application base URL for shareable content
export const APP_BASE_URL = import.meta.env.VITE_APP_DOMAIN || 'https://wutch.fun';

/**
 * Create an absolute URL for shareable content
 * Always uses the production domain regardless of where the app is running
 */
export const makeAbsoluteUrl = (path: string): string => {
  return new URL(path, APP_BASE_URL).toString();
};
