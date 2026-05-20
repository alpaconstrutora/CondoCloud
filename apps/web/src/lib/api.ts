import { supabase } from './supabase';

const API_URL = '/api/v1';
const ACTIVE_CONDO_KEY = 'condocloud:active_condo';

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const activeCondoId = localStorage.getItem(ACTIVE_CONDO_KEY);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeCondoId ? { 'X-Active-Condo-ID': activeCondoId } : {}),
        ...options?.headers,
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error).name === 'AbortError') throw new Error('Tempo limite da requisição esgotado. Verifique sua conexão.');
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
  }
  clearTimeout(timeout);

  const text = await res.text();

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try { message = (JSON.parse(text) as { message?: string }).message ?? message; } catch { /* html */ }
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
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
