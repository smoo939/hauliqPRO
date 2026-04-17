import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hauliq.app',
  appName: 'Hauliq',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    buildOptions: {
      releaseType: 'AAB',
    },
  },
  plugins: {
    Geolocation: {
      permissions: ['location'],
    },
  },
};

export default config;
