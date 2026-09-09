/** API client — JWT-aware fetch wrapper. */
const TOKEN_KEY = 'advocate_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!formData) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: formData ? body : body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch (e) { json = { ok: false, error: 'bad_response' }; }
  if (res.status === 401) {
    clearToken();
    if (!path.startsWith('/auth/login')) window.location.href = '/login';
  }
  if (!res.ok || json.ok === false) {
    const err = new Error(json.error || `http_${res.status}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json.data;
}

export const download = (path, filename) => {
  const token = getToken();
  const url = `/api${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || '';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export default api;
