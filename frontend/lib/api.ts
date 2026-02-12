// frontend/lib/api.ts
import { getAuthHeaders } from "./auth";

const API_BASE = "http://localhost:8000/api";

/**
 * Generic fetch wrapper for protected routes
 */
export async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  
  // Combine auth headers with any provided headers
  const headers = new Headers(getAuthHeaders());
  if (options.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => headers.set(key, value));
  }
  
  return fetch(url, { 
    ...options, 
    headers,
    credentials: "include", 
  });
}

/**
 * Gmail API helpers
 */
export const gmailApi = {
  getAuthUrl: async () => {
    const res = await fetch(`${API_BASE}/gmail/auth/url`);
    return res.json();
  },

  checkAuthStatus: async () => {
    const res = await fetch(`${API_BASE}/gmail/auth/status`);
    return res.json();
  },

  fetchStatements: async (filters?: { maxResults?: number }) => {
    const url = filters?.maxResults ? `/gmail/fetch?maxResults=${filters.maxResults}` : "/gmail/fetch";
    const res = await fetchWithAuth(url, { method: "POST" });
    if (!res.ok) throw new Error("Gmail fetch failed");
    return res.json();
  },
};

/**
 * Statements API helpers
 */
export const statementsApi = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append("statement", file);

    // Note: We don't set Content-Type header here; fetch sets it automatically for FormData
    const res = await fetchWithAuth("/statements/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Upload failed");
    }

    return res.json();
  },

  getAll: async () => {
    const res = await fetchWithAuth("/statements");
    if (!res.ok) throw new Error("Failed to fetch statements");
    return res.json();
  },

  delete: async (id: string) => {
    const res = await fetchWithAuth(`/statements/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    return res.json();
  },
};