"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { OrderDto, OrderStatus } from "shared";
import { useAuth } from "@/lib/auth-context";

const STATUS_COPY: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Waiting for payment to be confirmed…",
  PAID: "Payment confirmed — your order is being prepared.",
  FULFILLED: "Shipped.",
  CANCELLED: "Cancelled.",
  REFUNDED: "Refunded.",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, authFetch } = useAuth();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    enabled: !!user,
    // Payment confirmation lands via webhook, not this request — poll
    // briefly so the page updates itself once it does.
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING_PAYMENT" ? 3000 : false,
    queryFn: async () => {
      const res = await authFetch(`/orders/${id}`);
      return (await res.json()) as OrderDto;
    },
  });

  if (!user) return <p>Sign in to see this order.</p>;
  if (isLoading || !order) return <p className="text-black/50 dark:text-white/50">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Order #{order.id.slice(-8)}</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          {STATUS_COPY[order.status] ?? order.status}
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/15">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between py-3 text-sm">
            <span>
              {item.quantity} × {item.productNameSnapshot} ({item.variantNameSnapshot})
            </span>
            <span>₹{item.unitPrice}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/15">
        <span className="font-medium">Total</span>
        <span className="font-medium">
          {order.currency} {order.total}
        </span>
      </div>
    </div>
  );
}
