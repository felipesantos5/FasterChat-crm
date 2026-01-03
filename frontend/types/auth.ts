export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
  companyName?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  companyName: string;
}
