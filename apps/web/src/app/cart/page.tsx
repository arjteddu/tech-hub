"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import type { Cart } from "@/lib/api";

export default function CartPage() {
  const { user, authFetch } = useAuth();
  const queryClient = useQueryClient();

  const { data: cart, isLoading } = useQuery({
    queryKey: ["cart"],
    enabled: !!user,
    queryFn: async () => {
      const res = await authFetch("/cart");
      if (!res.ok) throw new Error("Failed to load cart");
      return res.json() as Promise<Cart>;
    },
  });

  async function updateQuantity(itemId: string, quantity: number) {
    await authFetch(`/cart/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    });
    queryClient.invalidateQueries({ queryKey: ["cart"] });
  }

  if (!user) {
    return (
      <p>
        <Link href="/login" className="underline">
          Sign in
        </Link>{" "}
        to see your cart.
      </p>
    );
  }
  if (isLoading) return <p className="text-black/50 dark:text-white/50">Loading…</p>;
  if (!cart || cart.items.length === 0) return <p>Your cart is empty.</p>;

  const total = cart.items.reduce(
    (sum, item) => sum + Number(item.variant.price) * item.quantity,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/15">
        {cart.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">{item.variant.name}</p>
              <p className="text-sm text-black/60 dark:text-white/60">₹{item.variant.price}</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={item.quantity}
                onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                className="w-16 rounded-md border border-black/15 px-2 py-1 text-center dark:border-white/20"
              />
              <button
                onClick={() => updateQuantity(item.id, 0)}
                className="text-sm text-black/50 dark:text-white/50"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/15">
        <span className="font-medium">Total</span>
        <span className="font-medium">₹{total.toFixed(2)}</span>
      </div>
      <Link
        href="/checkout"
        className="self-end rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        Checkout
      </Link>
    </div>
  );
}
