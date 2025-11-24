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

export const useAuthStore = create<AuthState>((set) => {
  // Não inicializa do localStorage aqui para evitar hydration mismatch
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true, // Começa como loading

    login: async (email, password) => {
    console.log('[AUTH] Iniciando login...');
    set({ isLoading: true });
    try {
      const response = await authApi.login({ email, password });
      console.log('[AUTH] Login bem-sucedido:', response);
      setAuthToken(response.token);
      setUser(response.user);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });
      console.log('[AUTH] Estado atualizado - isAuthenticated:', true);
    } catch (error) {
      console.error('[AUTH] Erro no login:', error);
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
    console.log('[AUTH] Carregando usuário do localStorage...');
    const token = getAuthToken();
    const savedUser = getUser();
    console.log('[AUTH] Token:', token ? 'existe' : 'não existe', 'User:', savedUser ? 'existe' : 'não existe');

    if (token && savedUser) {
      console.log('[AUTH] Restaurando sessão...');
      set({
        user: savedUser,
        token,
        isAuthenticated: true,
        isLoading: false,
      });

      // Validate token by fetching user
      try {
        const user = await authApi.getMe();
        setUser(user);
        set({ user });
        console.log('[AUTH] Token validado com sucesso');
      } catch (error) {
        // Token is invalid
        console.error('[AUTH] Token inválido:', error);
        removeAuthToken();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } else {
      // No saved auth data
      console.log('[AUTH] Nenhum dado de autenticação salvo');
      set({ isLoading: false });
    }
  },
}});

// Inicializa o store quando o módulo é carregado (lado do cliente)
if (typeof window !== 'undefined') {
  useAuthStore.getState().loadUser();
}
