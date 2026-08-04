"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function SiteHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          tech-hub
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/cart">Cart</Link>
          {user ? (
            <>
              <Link href="/orders">Orders</Link>
              <button onClick={logout} className="text-black/60 dark:text-white/60">
                Sign out ({user.email})
              </button>
            </>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
