"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function NewCategoryPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await authFetch("/catalog/categories", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name"), slug: form.get("slug") }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Could not create category");
      router.push("/admin/products/new");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-sm">
      <h1 className="mb-6 text-xl font-semibold">New category</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          name="name"
          placeholder="Name"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20"
        />
        <input
          name="slug"
          placeholder="Slug (e.g. accessories)"
          required
          pattern="[a-z0-9-]+"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Creating…" : "Create category"}
        </button>
      </form>
    </div>
  );
}
