"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function AddToCartButton({ variantId }: { variantId: string }) {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // No auth gate — guests get a cart too, tracked by X-Guest-Cart-Id
  // (see auth-context's authFetch) and merged into their account cart
  // if and when they sign in.
  async function addToCart() {
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
