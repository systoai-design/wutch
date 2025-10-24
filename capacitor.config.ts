import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.3561f8c1735e43eb9412fe29af22feae',
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
