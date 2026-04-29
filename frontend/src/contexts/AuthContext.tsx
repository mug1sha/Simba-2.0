import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { buildApiUrl, readJsonResponse } from "@/lib/api";

interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: "customer" | "branch_manager" | "branch_staff";
  branch?: string | null;
  is_verified: boolean;
  addresses: any[];
  payment_methods: any[];
  orders: any[];
  favorites: any[];
}

interface LoginPayload {
  access_token: string;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (payload: LoginPayload) => Promise<User | null>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshProfile: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState<boolean>(!!localStorage.getItem("token"));

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setIsLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    const activeToken = localStorage.getItem("token");
    if (!activeToken) {
      setIsLoading(false);
      return null;
    }
    try {
      const res = await fetch(buildApiUrl("/api/user/profile"), {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await readJsonResponse<User>(res, "Profile response was empty.");
        setUser(data);
        return data;
      } else {
        logout();
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [logout]);

  const login = useCallback(async (payload: LoginPayload) => {
    if (!payload?.access_token) {
      throw new Error("Login response is missing an access token.");
    }
    localStorage.setItem("token", payload.access_token);
    setToken(payload.access_token);
    if (payload.user) {
      setUser(payload.user);
      setIsLoading(false);
      return payload.user;
    }
    setIsLoading(true);
    return refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (token) {
      refreshProfile();
    }
  }, [token, refreshProfile]);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, isLoading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
