const TOKEN_KEY = 'filedrop.token';

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

// Every call carries the bearer token explicitly; nothing is sent ambiently by
// the browser, so a request made from another origin arrives unauthenticated.
async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken();
  const finalHeaders = { ...headers };
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }
  if (body && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    method,
    headers: finalHeaders,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const api = {
  register: (data) => request('/api/auth/register', { method: 'POST', body: data }),
  login: (data) => request('/api/auth/login', { method: 'POST', body: data }),
  me: () => request('/api/auth/me'),
  listFiles: () => request('/api/files'),
  uploadFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/api/files', { method: 'POST', body: form });
  },
  deleteFile: (name) => request(`/api/files/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  downloadFile: async (name) => {
    const response = await fetch(`/api/files/${encodeURIComponent(name)}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (!response.ok) {
      throw new Error('Download failed');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
};
