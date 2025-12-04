export interface SignupDTO {
  name: string;
  email: string;
  password: string;
  companyName: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  companyId: string;
  role: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyId: string;
  };
  token: string;
  refreshToken?: string;
}
