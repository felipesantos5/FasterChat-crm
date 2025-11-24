import { create } from 'zustand';
import { User } from '@/types/auth';
import { authApi, setAuthToken, removeAuthToken, setUser, getUser, getAuthToken } from '@/lib/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, companyName: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login({ email, password });
      setAuthToken(response.token);
      setUser(response.user);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signup: async (name, email, password, companyName) => {
    set({ isLoading: true });
    try {
      const response = await authApi.signup({ name, email, password, companyName });
      setAuthToken(response.token);
      setUser(response.user);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    removeAuthToken();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  loadUser: async () => {
    const token = getAuthToken();
    const savedUser = getUser();

    if (token && savedUser) {
      set({
        user: savedUser,
        token,
        isAuthenticated: true,
      });

      // Validate token by fetching user
      try {
        const user = await authApi.getMe();
        setUser(user);
        set({ user });
      } catch (error) {
        // Token is invalid
        removeAuthToken();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      }
    }
  },
}));
