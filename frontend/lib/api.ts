export const API_BASE = "";

export async function apiGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { "X-API-Token": token } });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function apiSend(path: string, token: string, method: string, body?: any, isFormData: boolean = false, signal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = { "X-API-Token": token };
  if (!isFormData && body) {
    headers["Content-Type"] = "application/json";
  }
  
  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    signal,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });
}
