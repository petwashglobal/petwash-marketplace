import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "il.co.petwash.customer",
  appName: "PetWash Customer",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
  },
  ios: {
    path: "ios-customer",
    contentInset: "always",
  },
  android: {
    path: "android-customer",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#ffffff",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
