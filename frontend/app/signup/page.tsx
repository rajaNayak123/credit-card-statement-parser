"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate fields before sending
    if (!name || !email || !password || !dob) {
      setError("Please fill in all fields including Date of Birth.");
      setLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    try {
      // Call custom JWT signup endpoint
      const result = await authApi.signup({
        name,
        email,
        password,
        dob,
      });

      if (result.success) {
        // Success: redirect to dashboard
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error || "Signup failed. Please try again.");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message || "An error occurred during signup.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl">
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          Create Account
        </h2>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-3 mb-4 rounded-lg text-sm border border-red-200">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <input 
              type="text" 
              placeholder="Full Name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
              required 
            />
          </div>
          
          <div>
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
              required 
            />
          </div>
          
          <div>
            <input 
              type="password" 
              placeholder="Password (min 6 characters)" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
              required 
              minLength={6}
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              Date of Birth (DD-MM-YYYY)
            </label>
            <input 
              type="text" 
              placeholder="15-08-1990" 
              value={dob} 
              onChange={(e) => setDob(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
              required 
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Format: DD-MM-YYYY or DD-MM
            </p>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>
        
        <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <a href="/login" className="text-purple-600 hover:underline font-semibold">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
