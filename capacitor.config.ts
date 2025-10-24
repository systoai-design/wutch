import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wutch.app',
  appName: 'Wutch',
  webDir: 'dist',
  server: {
    url: 'https://3561f8c1-735e-43eb-9412-fe29af22feae.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
