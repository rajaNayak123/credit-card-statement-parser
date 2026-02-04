"use client";

import { authClient } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "./LogoutButton";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const result = await authClient.getSession();
        const u = (result as any)?.data?.user ?? (result as any)?.user ?? null;

        if (!mounted) return;

        if (!u) {
          router.replace("/login");
          return;
        }

        setUser(u);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <LogoutButton />
      </div>

        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow p-6">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            Welcome, {user.name || user.email}!
          </p>
          <div className="mt-4 space-y-2 text-gray-700 dark:text-gray-300">
            <p>
              <span className="font-medium">Email:</span> {user.email}
            </p>
            {user.name && (
              <p>
                <span className="font-medium">Name:</span> {user.name}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
