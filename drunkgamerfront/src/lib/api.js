const DEFAULT_BASE = "https://oq99xk9tcl.execute-api.us-east-1.amazonaws.com";

export function joinUrl(base, path) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function createApi(base, fetchImpl = (...args) => fetch(...args)) {
  return async function api(path, { method = "GET", body } = {}) {
    const res = await fetchImpl(joinUrl(base, path), {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  };
}

export const api = createApi(import.meta.env?.VITE_API_BASE || DEFAULT_BASE);
