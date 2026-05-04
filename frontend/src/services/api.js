const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    const msg = data?.error || data?.mensagem || 'Erro ao comunicar com o servidor';
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export function authLogin({ email, password }) {
  return apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
}

export function authRegister({ nome, email, telefone, password, tipo }) {
  return apiFetch('/api/auth/register', { method: 'POST', body: { nome, email, telefone, password, tipo } });
}

export function authMe(token) {
  return apiFetch('/api/auth/me', { token });
}

