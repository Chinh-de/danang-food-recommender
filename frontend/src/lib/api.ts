const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000"

export class ApiError extends Error {
  status: number
  detail: unknown
  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `Lỗi ${status}`)
    this.status = status
    this.detail = detail
  }
}

type Params = Record<string, string | number | boolean | null | undefined>

function url(path: string, params?: Params) {
  const u = new URL(path, BASE)
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "" && v !== false) u.searchParams.set(k, String(v))
  }
  return u.toString()
}

async function request<T>(method: string, path: string, body?: unknown, params?: Params): Promise<T> {
  const res = await fetch(url(path, params), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? data)
  return data as T
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>("GET", path, undefined, params),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
}

/** Lỗi 422 của FastAPI -> { tên trường: thông báo }. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !Array.isArray(e.detail)) return {}
  const out: Record<string, string> = {}
  for (const d of e.detail as { loc: (string | number)[]; msg: string }[]) {
    out[String(d.loc[d.loc.length - 1])] = d.msg
  }
  return out
}
