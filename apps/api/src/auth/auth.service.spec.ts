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

    const service = new AuthService(prisma as any, jwt);
    const result = await service.register({ email: "shopper@example.com", password: "password123" });

    expect(result.user).toEqual({ id: "u1", email: "shopper@example.com", name: "Shopper", role: "CUSTOMER" });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it("rejects registering an email that's already taken", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: "existing" });

    const service = new AuthService(prisma as any, jwt);
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

    const service = new AuthService(prisma as any, jwt);
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

    const service = new AuthService(prisma as any, jwt);
    await expect(
      service.login({ email: "shopper@example.com", password: "wrong-password" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a login for an email that doesn't exist", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);

    const service = new AuthService(prisma as any, jwt);
    await expect(
      service.login({ email: "nobody@example.com", password: "password123" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("issues a fresh access token from a valid refresh token", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: "u1", email: "shopper@example.com" });

    const service = new AuthService(prisma as any, jwt);
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
    const service = new AuthService(prisma as any, jwt);
    await expect(service.refresh("not-a-real-token")).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a refresh token signed with the wrong secret", async () => {
    const prisma = makePrismaMock();
    const service = new AuthService(prisma as any, jwt);
    const forged = jwt.sign({ sub: "u1", role: "ADMIN" }, { secret: "not-the-real-secret" });
    await expect(service.refresh(forged)).rejects.toThrow(UnauthorizedException);
  });
});
