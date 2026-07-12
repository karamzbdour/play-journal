"use client";

const TOKEN_KEY = "play_journal_auth_token";
const USER_KEY = "play_journal_user";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// The Supabase user object the backend hands back at login - typed with just
// the fields the UI actually reads.
export interface StoredUser {
  id?: string;
  email?: string;
  full_name?: string;
  user_metadata?: { full_name?: string };
}

export function setUser(user: StoredUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

// Best-effort display name from the stored Supabase user: full name if the
// account has one, otherwise the email's local part.
export function getDisplayName(): string | null {
  const user = getUser();
  if (!user) return null;
  return user.user_metadata?.full_name || user.full_name || user.email?.split("@")[0] || null;
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };
}
