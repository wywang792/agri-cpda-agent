import * as SecureStore from 'expo-secure-store';
import { apiRequest } from './api';
import type { LoginRequest, LoginResponse } from '@agent-xfd/shared';

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const result = await apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST', body: JSON.stringify(data),
  });
  await SecureStore.setItemAsync('auth_token', result.token);
  await SecureStore.setItemAsync('username', result.user.username);
  await SecureStore.setItemAsync('user_role', result.user.role);
  return result;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync('auth_token');
}
