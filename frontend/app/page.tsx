"use client";

import { authApi } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        // Try to get current user session using custom JWT auth
        const result = await authApi.getMe();
        
        if (mounted && result?.success && result?.data?.user) {
          // User is logged in, redirect to dashboard
          router.replace("/dashboard");
          return;
        }
      } catch (error) {
        // User is not logged in (expected), continue to show home page
        console.log("No active session, showing home page");
      }
      
      if (mounted) setChecking(false);
    }

    check();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c0c0f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0f] text-white antialiased">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
        aria-hidden
      />

      <header className="relative z-10 border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight text-white">
            Statement Parser
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center md:pt-32 md:pb-28">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
            Parse credit card statements
            <br />
            <span className="text-emerald-400">without the hassle</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-400 md:text-xl">
            Upload PDFs or pull statements from Gmail. We extract transactions
            and balances so you can export, analyze, and stay on top of
            spending.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-black transition hover:bg-emerald-400"
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/2 px-6 py-3.5 text-base font-medium text-white transition hover:bg-white/10"
            >
              Log in
            </Link>
          </div>
        </section>

        {/* Value props */}
        <section className="border-t border-white/5 bg-white/2">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
            <div className="grid gap-12 md:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-white/2 p-8 transition hover:border-white/10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Upload or import
                </h3>
                <p className="mt-2 text-zinc-400">
                  Drop PDF statements or connect Gmail to fetch statements
                  automatically.
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/2 p-8 transition hover:border-white/10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Smart parsing
                </h3>
                <p className="mt-2 text-zinc-400">
                  Transactions, dates, and balances extracted so you don't have
                  to type them in.
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/2 p-8 transition hover:border-white/10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  One place for all
                </h3>
                <p className="mt-2 text-zinc-400">
                  All your statements in one dashboard. Export and track
                  spending over time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              Ready to simplify your statements?
            </h2>
            <p className="mt-3 text-zinc-400">
              Create an account and upload your first statement in under a
              minute.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-semibold text-black transition hover:bg-emerald-400"
            >
              Get started free
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-zinc-500">
          Credit Card Statement Parser — parse, track, export.
        </div>
      </footer>
    </div>
  );
}
