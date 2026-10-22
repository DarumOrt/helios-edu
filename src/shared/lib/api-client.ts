export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, `HTTP ${res.status}`, text);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export const fetcher = <T = unknown>(url: string): Promise<T> => api.get<T>(url);

// Разбор ошибки API формата { error, fields } (C# API и моки Next отвечают одинаково)
export function apiErrorInfo(failure: unknown): {
  status: number;
  error?: string;
  fields?: Record<string, string>;
} {
  if (!(failure instanceof ApiError)) return { status: 0 };
  try {
    const data = JSON.parse(String(failure.details ?? "")) as { error?: unknown; fields?: unknown };
    return {
      status: failure.status,
      error: typeof data.error === "string" ? data.error : undefined,
      fields:
        data.fields && typeof data.fields === "object" ? (data.fields as Record<string, string>) : undefined,
    };
  } catch {
    return { status: failure.status };
  }
}
