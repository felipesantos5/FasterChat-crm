import { create } from "zustand";

interface AdminAuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadToken: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3030";

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (username: string, password: string) => {
    const response = await fetch(`${API_URL}/api/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao fazer login");
    }

    const data = await response.json();

    localStorage.setItem("admin_token", data.token);
    set({ token: data.token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("admin_token");
    set({ token: null, isAuthenticated: false });
  },

  loadToken: () => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      set({ token, isAuthenticated: true, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },
}));
