import { getAuthHeaders } from "./auth";

const API_BASE = "http://localhost:8000/api";

/**
 * Fetch with JWT Authorization header for protected routes
 */
export async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers = new Headers(getAuthHeaders());
  
  // Merge with any existing headers
  if (options.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => headers.set(key, value));
  }
  
  return fetch(url, { 
    ...options, 
    headers,
    credentials: "include", // Include cookies for auth
  });
}

/**
 * Gmail API helpers
 */
export const gmailApi = {
  /**
   * Get Gmail OAuth URL
   */
  getAuthUrl: async () => {
    const res = await fetch(`${API_BASE}/gmail/auth/url`);
    const data = await res.json();
    return data;
  },

  /**
   * Check Gmail authentication status
   */
  checkAuthStatus: async () => {
    const res = await fetch(`${API_BASE}/gmail/auth/status`);
    const data = await res.json();
    return data;
  },

  /**
   * Disconnect Gmail
   */
  disconnect: async () => {
    const res = await fetchWithAuth("/gmail/auth/disconnect", {
      method: "POST",
    });
    const data = await res.json();
    return data;
  },

  /**
   * Fetch statements from Gmail
   */
  fetchStatements: async (filters?: {
    after?: string;
    before?: string;
    maxResults?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.after) params.append("after", filters.after);
    if (filters?.before) params.append("before", filters.before);
    if (filters?.maxResults) params.append("maxResults", filters.maxResults.toString());

    const queryString = params.toString();
    const url = queryString ? `/gmail/fetch?${queryString}` : "/gmail/fetch";

    const res = await fetchWithAuth(url, {
      method: "POST",
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    return data;
  },
};

/**
 * Statements API helpers
 */
export const statementsApi = {
  /**
   * Upload a statement file
   */
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append("statement", file);

    const token = localStorage.getItem("jwt_token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/statements/upload`, {
      method: "POST",
      headers,
      credentials: "include",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data;
  },

  /**
   * Get all statements
   */
  getAll: async () => {
    const res = await fetchWithAuth("/statements");
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    return data;
  },

  /**
   * Get statement by ID
   */
  getById: async (id: string) => {
    const res = await fetchWithAuth(`/statements/${id}`);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    return data;
  },

  /**
   * Delete statement
   */
  delete: async (id: string) => {
    const res = await fetchWithAuth(`/statements/${id}`, {
      method: "DELETE",
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Delete failed" }));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    return data;
  },
};