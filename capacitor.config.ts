import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.secureaccordhub',
  appName: 'secure-accord-hub',
  webDir: 'dist',
  server: {
    url: 'https://728f8609-1191-4046-bb71-e4a8f2b2313c.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
