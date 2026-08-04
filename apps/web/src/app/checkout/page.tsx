"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CheckoutResponseDto } from "shared";
import { useAuth } from "@/lib/auth-context";
import { loadRazorpayScript } from "@/lib/load-razorpay";
import type { Address } from "@/lib/api";

export default function CheckoutPage() {
  const { user, authFetch } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: addresses } = useQuery({
    queryKey: ["addresses"],
    enabled: !!user,
    queryFn: async () => {
      const res = await authFetch("/addresses");
      const list = (await res.json()) as Address[];
      if (list[0] && !selectedAddressId) setSelectedAddressId(list[0].id);
      return list;
    },
  });

  async function addAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await authFetch("/addresses", {
      method: "POST",
      body: JSON.stringify({
        line1: form.get("line1"),
        city: form.get("city"),
        state: form.get("state"),
        postalCode: form.get("postalCode"),
        phone: form.get("phone"),
      }),
    });
    const address = (await res.json()) as Address;
    setSelectedAddressId(address.id);
    queryClient.invalidateQueries({ queryKey: ["addresses"] });
  }

  async function pay() {
    if (!selectedAddressId) return;
    setError(null);
    setPaying(true);
    try {
      const res = await authFetch("/orders/checkout", {
        method: "POST",
        body: JSON.stringify({ addressId: selectedAddressId }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Checkout failed");
      const { order, razorpayOrderId, razorpayKeyId, amount, currency } =
        (await res.json()) as CheckoutResponseDto;

      await loadRazorpayScript();
      const RazorpayCheckout = window.Razorpay;
      if (!RazorpayCheckout) throw new Error("Razorpay checkout failed to load");
      const razorpay = new RazorpayCheckout({
        key: razorpayKeyId,
        order_id: razorpayOrderId,
        amount,
        currency,
        name: "tech-hub",
        prefill: { email: user?.email },
        // Razorpay's client callback fires on submission, not settlement —
        // the order only actually becomes PAID once our backend verifies
        // the webhook. This just sends the shopper to watch it happen.
        handler: () => router.push(`/orders/${order.id}`),
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPaying(false);
    }
  }

  if (!user) return <p>Sign in to check out.</p>;

  return (
    <div className="flex max-w-md flex-col gap-8">
      <section>
        <h2 className="mb-3 font-medium">Shipping address</h2>
        {addresses && addresses.length > 0 ? (
          <div className="flex flex-col gap-2">
            {addresses.map((a) => (
              <label key={a.id} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  checked={selectedAddressId === a.id}
                  onChange={() => setSelectedAddressId(a.id)}
                />
                <span>
                  {a.line1}, {a.city}, {a.state} {a.postalCode}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <form onSubmit={addAddress} className="flex flex-col gap-3">
            <input name="line1" placeholder="Address line" required className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20" />
            <input name="city" placeholder="City" required className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20" />
            <input name="state" placeholder="State" required className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20" />
            <input name="postalCode" placeholder="Postal code" required className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20" />
            <input name="phone" placeholder="Phone" className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20" />
            <button type="submit" className="self-start rounded-full border border-black/15 px-4 py-2 text-sm dark:border-white/20">
              Save address
            </button>
          </form>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={pay}
        disabled={!selectedAddressId || paying}
        className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {paying ? "Opening payment…" : "Pay with Razorpay"}
      </button>
    </div>
  );
}
