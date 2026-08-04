"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function AddToCartButton({ variantId }: { variantId: string }) {
  const { user, authFetch } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function addToCart() {
    if (!user) {
      router.push("/login");
      return;
    }
    setPending(true);
    try {
      const res = await authFetch("/cart/items", {
        method: "POST",
        body: JSON.stringify({ variantId, quantity: 1 }),
      });
      if (!res.ok) throw new Error("Could not add to cart");
      router.push("/cart");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={addToCart}
      disabled={pending}
      className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
    >
      {pending ? "Adding…" : "Add to cart"}
    </button>
  );
}
