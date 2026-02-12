// frontend/lib/auth.ts
const API_BASE = "http://localhost:8000/api";

/**
 * Auth API helpers using custom JWT authentication
 */
export const authApi = {
  /**
   * Sign up a new user
   */
  signup: async (data: { name: string; email: string; password: string; dob: string }) => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Important: sends cookies
      body: JSON.stringify(data),
    });

    const result = await res.json();
    
    if (!res.ok) {
      throw new Error(result.error || "Signup failed");
    }
    
    return result;
  },

  /**
   * Sign in an existing user
   */
  signin: async (data: { email: string; password: string }) => {
    const res = await fetch(`${API_BASE}/auth/signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Important: sends cookies
      body: JSON.stringify(data),
    });

    const result = await res.json();
    
    if (!res.ok) {
      throw new Error(result.error || "Login failed");
    }
    
    return result;
  },

  /**
   * Get current user session
   */
  getMe: async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: "GET",
      credentials: "include", // Important: sends cookies
    });

    const result = await res.json();
    
    if (!res.ok) {
      throw new Error(result.error || "Failed to get user");
    }
    
    return result;
  },

  /**
   * Logout current user
   */
  logout: async () => {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include", // Important: sends cookies
    });

    const result = await res.json();
    
    if (!res.ok) {
      throw new Error(result.error || "Logout failed");
    }
    
    return result;
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: { name?: string; dob?: string }) => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    const result = await res.json();
    
    if (!res.ok) {
      throw new Error(result.error || "Update failed");
    }
    
    return result;
  },

  /**
   * Change password
   */
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    const result = await res.json();
    
    if (!res.ok) {
      throw new Error(result.error || "Password change failed");
    }
    
    return result;
  },
};

/**
 * Get auth headers (empty since we use cookies)
 */
export function getAuthHeaders(): HeadersInit {
  // We're using httpOnly cookies, so no need to send Authorization header
  return {};
}