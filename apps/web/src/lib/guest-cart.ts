const STORAGE_KEY = "tech-hub.guestCartId";

// Identifies an anonymous shopper's cart to the api (Redis-backed, see
// CartService). Generated once per browser and sent as X-Guest-Cart-Id;
// cleared after login/register once the api has merged it into the
// account's real cart.
export function getOrCreateGuestCartId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function clearGuestCartId() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
}
