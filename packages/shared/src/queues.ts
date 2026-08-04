// Queue names and job payload shapes shared between the API (producer)
// and the worker (consumer) so the two never drift out of sync.

export const QUEUE_NAMES = {
  ORDER_EVENTS: "order-events",
} as const;

export type OrderConfirmationJob = {
  type: "order.confirmation";
  orderId: string;
};

export type InventorySyncJob = {
  type: "inventory.sync";
  variantId: string;
};

export type OrderEventJob = OrderConfirmationJob | InventorySyncJob;
