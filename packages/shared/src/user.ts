export type UserRole = 'buyer' | 'supplier' | 'admin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  marketId: string;
  createdAt: Date;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
