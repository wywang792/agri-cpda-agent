import * as SecureStore from 'expo-secure-store';
import { API_BASE } from './config';

const REQUEST_TIMEOUT_MS = 10000;

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('auth_token');
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `${API_BASE}${path}`;

  console.log(`[API] ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    console.log(`[API] Response status ${response.status}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`请求超时：无法连接 ${API_BASE}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
