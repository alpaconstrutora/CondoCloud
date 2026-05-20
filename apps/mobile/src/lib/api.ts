import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  const text = await res.text();

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? message;
    } catch { /* html */ }
    throw new Error(message);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Resposta inválida do servidor (${res.status})`);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
