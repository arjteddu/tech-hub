import { createHandlers } from "./handlers";

function makeDeps(overrides: { order?: unknown; sendResult?: { data?: unknown; error?: { message: string } | null } } = {}) {
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(overrides.order ?? null),
    },
  };
  const resend = {
    emails: {
      send: jest.fn().mockResolvedValue(overrides.sendResult ?? { data: { id: "email_1" }, error: null }),
    },
  };
  const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
  return { prisma, resend, logger };
}

const SAMPLE_ORDER = {
  id: "order_12345678",
  currency: "INR",
  total: "205.50",
  user: { email: "shopper@example.com" },
  items: [
    { quantity: 2, productNameSnapshot: "Canvas Tote Bag", variantNameSnapshot: "Black" },
    { quantity: 1, productNameSnapshot: "Insulated Water Bottle", variantNameSnapshot: "750ml" },
  ],
};

describe("handleOrderConfirmation", () => {
  it("skips quietly when the order no longer exists", async () => {
    const deps = makeDeps({ order: null });
    const { handleOrderConfirmation } = createHandlers(deps as any);

    await handleOrderConfirmation("missing-order");

    expect(deps.resend.emails.send).not.toHaveBeenCalled();
    expect(deps.logger.warn).toHaveBeenCalledWith(
      { orderId: "missing-order" },
      expect.stringContaining("not found"),
    );
  });

  it("sends a confirmation email with the order's items and total", async () => {
    const deps = makeDeps({ order: SAMPLE_ORDER });
    const { handleOrderConfirmation } = createHandlers(deps as any);

    await handleOrderConfirmation(SAMPLE_ORDER.id);

    expect(deps.resend.emails.send).toHaveBeenCalledTimes(1);
    const sent = deps.resend.emails.send.mock.calls[0][0];
    expect(sent.to).toBe("shopper@example.com");
    expect(sent.subject).toContain(SAMPLE_ORDER.id.slice(-8));
    expect(sent.text).toContain("Canvas Tote Bag");
    expect(sent.text).toContain("Insulated Water Bottle");
    expect(sent.text).toContain("INR 205.50");
  });

  it("throws when Resend rejects the send, instead of reporting success", async () => {
    const deps = makeDeps({
      order: SAMPLE_ORDER,
      sendResult: { data: undefined, error: { message: "API key is invalid" } },
    });
    const { handleOrderConfirmation } = createHandlers(deps as any);

    await expect(handleOrderConfirmation(SAMPLE_ORDER.id)).rejects.toThrow("API key is invalid");
  });
});
