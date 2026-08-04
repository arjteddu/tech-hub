"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

// Client-side gate is UX only — every admin endpoint is already enforced
// server-side by RolesGuard (see apps/api/src/common/guards/roles.guard.ts).
// This just avoids showing the forms to someone who can't use them.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user) return <p>Sign in to access the admin area.</p>;
  if (user.role !== "ADMIN") return <p>You don&apos;t have access to this page.</p>;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex gap-5 border-b border-black/10 pb-4 text-sm dark:border-white/15">
        <Link href="/admin/products/new" className="underline">
          New product
        </Link>
        <Link href="/admin/categories/new" className="underline">
          New category
        </Link>
      </nav>
      {children}
    </div>
  );
}
