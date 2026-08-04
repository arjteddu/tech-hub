import { JwtService } from "@nestjs/jwt";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

function makePrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
}

function makeCartMock() {
  return { mergeGuestCartIntoUserCart: jest.fn().mockResolvedValue(undefined) };
}

describe("AuthService", () => {
  const jwt = new JwtService({});

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret-not-real";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-not-real";
  });

  it("registers a new user and returns tokens", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "u1",
      email: "shopper@example.com",
      name: "Shopper",
      role: "CUSTOMER",
      passwordHash: "irrelevant",
    });

    const service = new AuthService(prisma as any, jwt, makeCartMock() as any);
    const result = await service.register({ email: "shopper@example.com", password: "password123" });

    expect(result.user).toEqual({ id: "u1", email: "shopper@example.com", name: "Shopper", role: "CUSTOMER" });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it("rejects registering an email that's already taken", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: "existing" });

    const service = new AuthService(prisma as any, jwt, makeCartMock() as any);
    await expect(
      service.register({ email: "shopper@example.com", password: "password123" }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("logs in with correct credentials", async () => {
    const prisma = makePrismaMock();
    const passwordHash = await bcrypt.hash("password123", 12);
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "shopper@example.com",
      name: null,
      role: "CUSTOMER",
      passwordHash,
    });

    const service = new AuthService(prisma as any, jwt, makeCartMock() as any);
    const result = await service.login({ email: "shopper@example.com", password: "password123" });

    expect(result.accessToken).toBeTruthy();
  });

  it("rejects a wrong password", async () => {
    const prisma = makePrismaMock();
    const passwordHash = await bcrypt.hash("password123", 12);
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "shopper@example.com",
      passwordHash,
    });

    const service = new AuthService(prisma as any, jwt, makeCartMock() as any);
    await expect(
      service.login({ email: "shopper@example.com", password: "wrong-password" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a login for an email that doesn't exist", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);

    const service = new AuthService(prisma as any, jwt, makeCartMock() as any);
    await expect(
      service.login({ email: "nobody@example.com", password: "password123" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("issues a fresh access token from a valid refresh token", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: "u1", email: "shopper@example.com" });

    const service = new AuthService(prisma as any, jwt, makeCartMock() as any);
    const refreshToken = jwt.sign(
      { sub: "u1", role: "CUSTOMER" },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: "30d" },
    );

    const result = await service.refresh(refreshToken);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it("rejects a garbage refresh token", async () => {
    const prisma = makePrismaMock();
    const service = new AuthService(prisma as any, jwt, makeCartMock() as any);
    await expect(service.refresh("not-a-real-token")).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a refresh token signed with the wrong secret", async () => {
    const prisma = makePrismaMock();
    const service = new AuthService(prisma as any, jwt, makeCartMock() as any);
    const forged = jwt.sign({ sub: "u1", role: "ADMIN" }, { secret: "not-the-real-secret" });
    await expect(service.refresh(forged)).rejects.toThrow(UnauthorizedException);
  });

  it("merges a guest cart into the new account on register, when one was sent", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u1", email: "a@b.com", name: null, role: "CUSTOMER" });
    const cart = makeCartMock();

    const service = new AuthService(prisma as any, jwt, cart as any);
    await service.register({ email: "a@b.com", password: "password123" }, "guest-123");

    expect(cart.mergeGuestCartIntoUserCart).toHaveBeenCalledWith("u1", "guest-123");
  });

  it("does not touch the cart on register when no guest cart id was sent", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u1", email: "a@b.com", name: null, role: "CUSTOMER" });
    const cart = makeCartMock();

    const service = new AuthService(prisma as any, jwt, cart as any);
    await service.register({ email: "a@b.com", password: "password123" });

    expect(cart.mergeGuestCartIntoUserCart).not.toHaveBeenCalled();
  });

  it("merges a guest cart into the account on login, when one was sent", async () => {
    const prisma = makePrismaMock();
    const passwordHash = await bcrypt.hash("password123", 12);
    prisma.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com", passwordHash });
    const cart = makeCartMock();

    const service = new AuthService(prisma as any, jwt, cart as any);
    await service.login({ email: "a@b.com", password: "password123" }, "guest-456");

    expect(cart.mergeGuestCartIntoUserCart).toHaveBeenCalledWith("u1", "guest-456");
  });
});
