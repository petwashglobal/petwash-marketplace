// FILE: App.tsx
// Pet Wash™ - Unified Auth + Biometrics + API Client + App Shell
// TypeScript - React Native / Expo style
// 
// FUTURE-PROOF DESIGN:
// - Uses expo-local-authentication (tracks iOS Face ID & Android Biometric API changes)
// - Uses expo-secure-store (tracks iOS Keychain & Android Keystore changes)
// - When you run `npm update` or upgrade Expo/React Native, biometrics stay current
// - No manual firmware-specific code - libraries handle OS changes

import React, { useEffect, useState, useCallback, createContext, useContext } from "react";
import { View, Text, ActivityIndicator, Button, TextInput, StyleSheet, TouchableOpacity, Alert } from "react-native";
import axios, { AxiosInstance } from "axios";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

// ============================================================
// 1. CONFIG
// ============================================================

// Override at build time: `EXPO_PUBLIC_API_BASE=https://staging.petwash.co.il eas build ...`
// The EXPO_PUBLIC_ prefix is required for Expo to inline the value into the JS bundle.
const API_BASE =
  (typeof process !== "undefined" && process.env && process.env.EXPO_PUBLIC_API_BASE) ||
  "https://api.petwash.co.il";

const SECURE_REFRESH_KEY = "PETWASH_REFRESH_TOKEN";
const SECURE_BIOMETRICS_ENABLED_KEY = "PETWASH_BIOMETRICS_ENABLED";

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// ============================================================
// 2. TYPES
// ============================================================

export type AuthUser = {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  firstName?: string;
  lastName?: string;
};

export type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  isLocked: boolean; // app locked, needs biometrics or login
};

// ============================================================
// 3. BIOMETRICS + AUTH CONTROLLER (SINGLE SOURCE OF TRUTH)
// ============================================================

class BiometricsAuthController {
  private static instance: BiometricsAuthController;
  private authState: AuthState = { accessToken: null, user: null, isLocked: true };
  private lockTimer: NodeJS.Timeout | null = null;

  private subscribers: Set<(state: AuthState) => void> = new Set();

  static getInstance() {
    if (!BiometricsAuthController.instance) {
      BiometricsAuthController.instance = new BiometricsAuthController();
    }
    return BiometricsAuthController.instance;
  }

  subscribe(listener: (state: AuthState) => void) {
    this.subscribers.add(listener);
    listener(this.authState);
    return () => this.subscribers.delete(listener);
  }

  private notify() {
    for (const listener of this.subscribers) {
      listener(this.authState);
    }
  }

  private setState(partial: Partial<AuthState>) {
    this.authState = { ...this.authState, ...partial };
    this.notify();
  }

  getAuthState(): AuthState {
    return this.authState;
  }

  // Called whenever user interacts with the app
  registerActivity() {
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
    }
    this.lockTimer = setTimeout(() => {
      this.lockApp();
    }, INACTIVITY_TIMEOUT_MS);
  }

  private lockApp() {
    this.setState({ accessToken: null, isLocked: true });
  }

  async checkBiometricsAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return supportedTypes.length > 0;
  }

  async isBiometricsEnabled(): Promise<boolean> {
    const flag = await SecureStore.getItemAsync(SECURE_BIOMETRICS_ENABLED_KEY);
    return flag === "true";
  }

  private async enableBiometrics(refreshToken: string) {
    await SecureStore.setItemAsync(SECURE_REFRESH_KEY, refreshToken, {
      keychainService: "petwash.refresh",
    });
    await SecureStore.setItemAsync(SECURE_BIOMETRICS_ENABLED_KEY, "true", {
      keychainService: "petwash.flags",
    });
  }

  private async storeRefreshToken(refreshToken: string) {
    await SecureStore.setItemAsync(SECURE_REFRESH_KEY, refreshToken, {
      keychainService: "petwash.refresh",
    });
  }

  private async clearSecureTokens() {
    await SecureStore.deleteItemAsync(SECURE_REFRESH_KEY);
    await SecureStore.deleteItemAsync(SECURE_BIOMETRICS_ENABLED_KEY);
  }

  // First login with email/password or OAuth
  async loginWithCredentials(email: string, password: string): Promise<void> {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email,
      password,
    });

    const { accessToken, refreshToken, user } = res.data;

    this.setState({ accessToken, user, isLocked: false });
    this.registerActivity();

    const canUseBiometrics = await this.checkBiometricsAvailable();
    if (canUseBiometrics) {
      // In a real app show a UI prompt "Enable Face ID or fingerprint?"
      await this.enableBiometrics(refreshToken);
    } else {
      // fallback: still store refresh token for silent login without biometrics
      await this.storeRefreshToken(refreshToken);
    }
  }

  // Main entry on app start: try biometric unlock
  async tryBiometricLogin(): Promise<boolean> {
    const biometricsEnabled = await this.isBiometricsEnabled();
    if (!biometricsEnabled) return false;

    const refreshToken = await SecureStore.getItemAsync(SECURE_REFRESH_KEY);
    if (!refreshToken) return false;

    const biometricResult = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Pet Wash™",
      cancelLabel: "Cancel",
      fallbackLabel: "Use password",
    });

    if (!biometricResult.success) {
      return false;
    }

    // Biometric success - refresh tokens
    try {
      const res = await axios.post(`${API_BASE}/auth/refresh`, {
        refreshToken,
      });

      const { accessToken, refreshToken: newRefresh, user } = res.data;

      this.setState({ accessToken, user, isLocked: false });
      this.registerActivity();

      if (newRefresh) {
        await this.storeRefreshToken(newRefresh);
      }

      return true;
    } catch (err) {
      console.error("Biometric refresh failed", err);
      await this.clearSecureTokens();
      this.setState({ accessToken: null, user: null, isLocked: true });
      return false;
    }
  }

  // Silent refresh for API calls
  async getValidAccessToken(): Promise<string | null> {
    // If we already have one in memory, return it
    if (this.authState.accessToken && !this.authState.isLocked) {
      return this.authState.accessToken;
    }

    // Try refresh without showing biometric prompt
    const refreshToken = await SecureStore.getItemAsync(SECURE_REFRESH_KEY);
    if (!refreshToken) return null;

    try {
      const res = await axios.post(`${API_BASE}/auth/refresh`, {
        refreshToken,
      });
      const { accessToken, refreshToken: newRefresh, user } = res.data;

      this.setState({ accessToken, user, isLocked: false });
      this.registerActivity();

      if (newRefresh) {
        await this.storeRefreshToken(newRefresh);
      }

      return accessToken;
    } catch (err) {
      console.error("Silent refresh failed", err);
      await this.clearSecureTokens();
      this.setState({ accessToken: null, user: null, isLocked: true });
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      const refreshToken = await SecureStore.getItemAsync(SECURE_REFRESH_KEY);
      if (refreshToken) {
        await axios.post(`${API_BASE}/auth/logout`, { refreshToken });
      }
    } catch (err) {
      console.warn("Logout call failed, proceeding to local cleanup", err);
    }

    await this.clearSecureTokens();
    this.setState({ accessToken: null, user: null, isLocked: true });
    if (this.lockTimer) clearTimeout(this.lockTimer);
  }

  // ============================================================
  // HIGH-RISK ACTION RE-AUTHENTICATION
  // Use this for sensitive operations like:
  // - Delete K9000 station
  // - Change revenue share percentage
  // - Modify partner settlements
  // - Approve large payouts
  // ============================================================
  async requireBiometricForHighRiskAction(actionName: string): Promise<boolean> {
    const available = await this.checkBiometricsAvailable();
    if (!available) {
      // Fallback: show password prompt
      Alert.alert(
        "Authentication Required",
        `This is a sensitive operation: ${actionName}. Please authenticate.`,
        [{ text: "Cancel", style: "cancel" }]
      );
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Authenticate to: ${actionName}`,
      cancelLabel: "Cancel",
      fallbackLabel: "Use password",
    });

    return result.success;
  }
}

// ============================================================
// 4. GLOBAL API CLIENT THAT ALWAYS USES LATEST TOKEN
// ============================================================

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use(async (config) => {
  const controller = BiometricsAuthController.getInstance();
  const token = await controller.getValidAccessToken();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    controller.registerActivity();
  }

  return config;
});

// ============================================================
// 5. REACT CONTEXT FOR AUTH STATE (ALL SCREENS CAN READ IT)
// ============================================================

type AuthContextValue = {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  biometricUnlock: () => Promise<boolean>;
  logout: () => Promise<void>;
  requireBiometricAuth: (actionName: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    user: null,
    isLocked: true,
  });

  useEffect(() => {
    const controller = BiometricsAuthController.getInstance();
    const unsubscribe = controller.subscribe(setState);

    // On first app start, try biometric unlock
    (async () => {
      try {
        await controller.tryBiometricLogin();
      } catch (err) {
        console.error("Biometric login at startup failed", err);
      }
    })();

    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const controller = BiometricsAuthController.getInstance();
    await controller.loginWithCredentials(email, password);
  }, []);

  const biometricUnlock = useCallback(async () => {
    const controller = BiometricsAuthController.getInstance();
    return controller.tryBiometricLogin();
  }, []);

  const logout = useCallback(async () => {
    const controller = BiometricsAuthController.getInstance();
    await controller.logout();
  }, []);

  const requireBiometricAuth = useCallback(async (actionName: string) => {
    const controller = BiometricsAuthController.getInstance();
    return controller.requireBiometricForHighRiskAction(actionName);
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, biometricUnlock, logout, requireBiometricAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// ============================================================
// 6. SIMPLE LOGIN SCREEN EXAMPLE
// ============================================================

const LoginScreen: React.FC = () => {
  const { login, biometricUnlock } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    const check = async () => {
      const controller = BiometricsAuthController.getInstance();
      const available = await controller.checkBiometricsAvailable();
      const enabled = await controller.isBiometricsEnabled();
      setBiometricSupported(available && enabled);
    };
    check();
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await login(email.trim(), password);
    } catch (err: any) {
      console.error("Login failed", err?.response?.data || err);
      Alert.alert("Login Failed", err?.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    try {
      setLoading(true);
      const ok = await biometricUnlock();
      if (!ok) {
        Alert.alert("Authentication Failed", "Biometric unlock was canceled or failed");
      }
    } catch (err) {
      console.error("Biometric unlock failed", err);
      Alert.alert("Error", "Biometric authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🐾 Pet Wash™</Text>
      <Text style={styles.title}>Staff Login</Text>

      <TextInput
        style={styles.input}
        value={email}
        autoCapitalize="none"
        placeholder="Email"
        placeholderTextColor="#64748b"
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        value={password}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor="#64748b"
        onChangeText={setPassword}
      />

      <TouchableOpacity onPress={handleLogin} style={styles.button} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Logging in..." : "Login"}</Text>
      </TouchableOpacity>

      {biometricSupported && (
        <TouchableOpacity onPress={handleBiometric} style={[styles.button, styles.secondaryButton]} disabled={loading}>
          <Text style={styles.buttonText}>🔒 Unlock with Face ID / Fingerprint</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============================================================
// 7. MAIN APP SHELL (AFTER AUTH)
// ============================================================

const MainAppNavigator: React.FC = () => {
  const { state, logout, requireBiometricAuth } = useAuth();

  const callProtectedEndpoint = async () => {
    try {
      const res = await api.get("/staff/me");
      console.log("Protected data:", res.data);
      Alert.alert("Success", JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.error("Protected API call failed", err);
      Alert.alert("Error", "Failed to fetch protected data");
    }
  };

  const handleHighRiskAction = async () => {
    const confirmed = await requireBiometricAuth("Delete K9000 Station");
    if (confirmed) {
      Alert.alert("Success", "High-risk action approved!");
      // Proceed with actual deletion
      // await api.delete("/stations/123");
    } else {
      Alert.alert("Canceled", "High-risk action was not approved");
    }
  };

  if (!state.user) return null;

  const userName = state.user.firstName && state.user.lastName
    ? `${state.user.firstName} ${state.user.lastName}`
    : state.user.email;

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🐾 Pet Wash™</Text>
      <Text style={styles.title}>Welcome, {userName}</Text>
      <Text style={styles.subtitle}>Roles: {state.user.roles.join(", ")}</Text>

      <TouchableOpacity onPress={callProtectedEndpoint} style={styles.button}>
        <Text style={styles.buttonText}>Test Protected API</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleHighRiskAction} style={[styles.button, styles.warningButton]}>
        <Text style={styles.buttonText}>⚠️ High-Risk Action (Requires Biometric)</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={logout} style={[styles.button, styles.secondaryButton]}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================
// 8. ROOT APP COMPONENT
// ============================================================

const RootApp: React.FC = () => {
  const { state } = useAuth();

  // While state isLocked and no user, show login
  if (state.isLocked || !state.user || !state.accessToken) {
    return <LoginScreen />;
  }

  return <MainAppNavigator />;
};

// ============================================================
// 9. EXPORT DEFAULT APP
// ============================================================

const App: React.FC = () => {
  return (
    <AuthProvider>
      <RootApp />
    </AuthProvider>
  );
};

export default App;

// Export API client for use in other components
export { api };

// ============================================================
// 10. STYLES - Pet Wash™ Luxury Brand Colors
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: "stretch",
    justifyContent: "center",
    backgroundColor: "#0f172a", // Dark navy background
  },
  logo: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    color: "#f9fafb",
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#cbd5e1",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#f9fafb",
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#22c55e", // Pet Wash green
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  secondaryButton: {
    backgroundColor: "#0ea5e9", // Pet Wash blue
  },
  warningButton: {
    backgroundColor: "#f59e0b", // Orange for high-risk
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
});
