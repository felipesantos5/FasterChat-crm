import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3031";

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Flag para evitar loops de redirect
let isRefreshing = false;
let isRedirecting = false;

// Add token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Adiciona token para todas as rotas, exceto login, signup e refresh
    const publicRoutes = ['/auth/login', '/auth/signup', '/auth/refresh'];
    const isPublicRoute = publicRoutes.some(route => config.url?.includes(route));

    if (!isPublicRoute) {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`[API] Request to ${config.url} with token`);
      } else {
        console.warn(`[API] No token found for request to ${config.url}`);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Fila de requisições aguardando refresh
let refreshTokenPromise: Promise<string> | null = null;

// Handle token expiration and errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Rotas públicas que não devem tentar refresh
    const publicRoutes = ['/auth/login', '/auth/signup', '/auth/refresh'];
    const isPublicRoute = publicRoutes.some(route => originalRequest.url?.includes(route));

    // Se é erro 401 e não é uma rota pública
    if (error.response?.status === 401 && !isPublicRoute) {
      const errorData = error.response.data as any;

      console.log(`[API] ⚠️ 401 Error on ${originalRequest.url}:`, errorData?.message || 'Unauthorized');
      console.log(`[API] Error code:`, errorData?.code);

      // Evita loops de retry
      if (originalRequest._retry) {
        console.error('[API] ❌ Retry já tentado anteriormente, fazendo logout');
        handleLogout();
        return Promise.reject(error);
      }

      // Marca que já tentamos fazer retry desta requisição
      originalRequest._retry = true;

      // Verifica se tem refresh token disponível
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        console.error('[API] ❌ No refresh token available, fazendo logout');
        handleLogout();
        return Promise.reject(error);
      }

      try {
        // Se já está refreshing, aguarda o refresh atual
        if (refreshTokenPromise) {
          console.log('[API] ⏳ Aguardando refresh token em andamento...');
          const newToken = await refreshTokenPromise;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          console.log('[API] ✅ Token atualizado, retrying request');
          return api(originalRequest);
        }

        // Inicia novo refresh
        console.log('[API] 🔄 Iniciando refresh token...');
        refreshTokenPromise = (async () => {
          try {
            const response = await axios.post(`${API_URL}/api/auth/refresh`, {
              refreshToken,
            });

            const { token: newToken, refreshToken: newRefreshToken } = response.data.data;

            // Salva novos tokens
            localStorage.setItem("token", newToken);
            if (newRefreshToken) {
              localStorage.setItem("refreshToken", newRefreshToken);
            }

            console.log('[API] ✅ Token refreshed successfully!');
            return newToken;
          } finally {
            // Limpa a promise para permitir novos refreshes no futuro
            refreshTokenPromise = null;
          }
        })();

        const newToken = await refreshTokenPromise;

        // Atualiza header do request original
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        console.log('[API] ♻️ Retrying original request with new token');
        // Retry a requisição original
        return api(originalRequest);

      } catch (refreshError: any) {
        console.error('[API] ❌ Refresh token failed:', refreshError?.response?.data || refreshError.message);
        refreshTokenPromise = null;
        handleLogout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Função auxiliar para logout
function handleLogout() {
  if (isRedirecting) return; // Evita múltiplos redirects

  isRedirecting = true;
  console.log('[API] Clearing session and redirecting to login');

  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");

  // Pequeno delay para evitar race conditions
  setTimeout(() => {
    window.location.href = "/auth/login";
  }, 100);
}

export default api;
