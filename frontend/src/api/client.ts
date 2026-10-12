import { storage } from "@/src/utils/storage";

export const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
export const TOKEN_KEY = "dashbite_token";

export async function getToken(): Promise<string | null> {
  return storage.secureGet<string | null>(TOKEN_KEY, null);
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as any)?.detail;
    throw new Error(typeof detail === "string" ? detail : "Something went wrong");
  }
  return data as T;
}

export function wsUrl(path: string): string {
  return API_URL.replace(/^http/, "ws") + path;
}
