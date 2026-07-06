export class ApiError extends Error {
  constructor(public status: number, public data: any) {
    super(data.error || 'An error occurred');
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, isJson ? data : { error: data });
  }

  return data as T;
}

export const api = {
  get: <T>(url: string, options?: RequestInit) => request<T>(url, { ...options, method: 'GET' }),
  post: <T>(url: string, body: any, options?: RequestInit) => request<T>(url, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T>(url: string, body: any, options?: RequestInit) => request<T>(url, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(url: string, options?: RequestInit) => request<T>(url, { ...options, method: 'DELETE' }),
};
