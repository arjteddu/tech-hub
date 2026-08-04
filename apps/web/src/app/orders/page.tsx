"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { OrderDto } from "shared";
import { useAuth } from "@/lib/auth-context";

export default function OrdersPage() {
  const { user, authFetch } = useAuth();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    enabled: !!user,
    queryFn: async () => {
      const res = await authFetch("/orders");
      return (await res.json()) as OrderDto[];
    },
  });

  if (!user) return <p>Sign in to see your orders.</p>;
  if (isLoading) return <p className="text-black/50 dark:text-white/50">Loading…</p>;
  if (!orders || orders.length === 0) return <p>No orders yet.</p>;

  return (
    <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/15">
      {orders.map((order) => (
        <li key={order.id} className="py-4">
          <Link href={`/orders/${order.id}`} className="flex items-center justify-between">
            <span>#{order.id.slice(-8)}</span>
            <span className="text-sm text-black/60 dark:text-white/60">{order.status}</span>
            <span>
              {order.currency} {order.total}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
