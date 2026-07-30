import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "il.co.petwash.provider",
  appName: "PetWash Provider",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    // Route native HTTP through the OS layer so the bundled app's /api calls reach the real
    // backend without browser CORS limits (apiConfig.ts points native builds at the production
    // API). Auth uses a Firebase Bearer header, so there is no cookie/SameSite concern.
    CapacitorHttp: {
      enabled: true,
    },
    // Native Google/Apple sign-in. Without this `providers` list the plugin
    // enables ZERO providers ("sign-in provider is not enabled") and every
    // social button fails instantly in the app. skipNativeAuth: the plugin
    // only returns the OAuth credential — the Firebase JS SDK exchanges it
    // (signInWithCredential) so session/loyalty/consent flow matches web.
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ["google.com", "apple.com"],
    },
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
