export const usePhpApi = import.meta.env.VITE_GYM_BACKEND === "php";

type Session = {
  user: { id: string; email: string; role: "admin" | "viewer" } | null;
  csrfToken: string;
};

export class PhpApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    throw new PhpApiError(body?.error ?? "The gym API could not complete the request.", response.status);
  }
  return body as T;
}

export const phpGet = <T>(path: string) => request<T>(path);
export const phpSession = () => phpGet<Session>("/auth/session");

export async function phpPost<T>(path: string, body?: object): Promise<T> {
  const { csrfToken } = await phpSession();
  const headers = new Headers({ "X-CSRF-Token": csrfToken });
  if (!(body instanceof FormData) && body !== undefined) headers.set("Content-Type", "application/json");
  return request<T>(path, {
    method: "POST",
    headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function phpSignIn(email: string, password: string) {
  const session = await phpPost<Session>("/auth/login", { email, password });
  if (session.user?.role !== "admin") {
    await phpSignOut();
    throw new PhpApiError("Administrator access is required.", 403);
  }
}

export const phpSignOut = () => phpPost<Session>("/auth/logout");
