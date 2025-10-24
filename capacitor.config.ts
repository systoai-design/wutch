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
      url: 'https://3561f8c1-735e-43eb-9412-fe29af22feae.lovableproject.com?forceHideBadge=true',
      cleartext: true
    },
    android: {
      allowMixedContent: true
    }
  })
};

export default config;
