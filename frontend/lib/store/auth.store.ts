import { create } from 'zustand';
import { User } from '@/types/auth';
import { authApi, setAuthToken, setRefreshToken, removeAuthToken, setUser, getUser, getAuthToken } from '@/lib/auth';

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

export const useAuthStore = create<AuthState>((set) => {
  // Não inicializa do localStorage aqui para evitar hydration mismatch
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true, // Começa como loading

    login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login({ email, password });
      setAuthToken(response.token);
      if (response.refreshToken) {
        setRefreshToken(response.refreshToken);
      }
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
      if (response.refreshToken) {
        setRefreshToken(response.refreshToken);
      }
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
      // Restaura autenticação do localStorage imediatamente
      set({
        user: savedUser,
        token,
        isAuthenticated: true,
        isLoading: false,
      });

      // Valida token em background (não bloqueia e não desloga em erro de rede)
      try {
        const user = await authApi.getMe();
        setUser(user);
        set({ user });
      } catch (error: any) {
        // Só desloga se for erro 401 (token inválido/expirado)
        // Não desloga em erros de rede (ECONNREFUSED, timeout, etc)
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          removeAuthToken();
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      }
    } else {
      // No saved auth data
      set({ isLoading: false });
    }
  },
}});

// Inicializa o store quando o módulo é carregado (lado do cliente)
if (typeof window !== 'undefined') {
  useAuthStore.getState().loadUser();
}

