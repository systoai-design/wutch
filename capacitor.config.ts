import { CapacitorConfig } from '@capacitor/cli';

// Environment-aware configuration
// For development: uses hosted URL with hot reload
// For production: uses bundled web assets (no server config)
const isDevelopment = process.env.NODE_ENV !== 'production';

const config: CapacitorConfig = {
  appId: 'com.wutch.app',
  appName: 'Wutch',
  webDir: 'dist',
  ...(isDevelopment && {
    server: {
      url: 'https://wutch.fun?forceHideBadge=true',
      cleartext: true
    },
    android: {
      allowMixedContent: true
    }
  })
};

export default config;
