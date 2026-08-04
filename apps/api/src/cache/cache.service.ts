import { Inject, Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS } from "./redis.token";

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /**
   * Cache-aside with a namespace version stamp: bumping the version
   * instantly "deletes" every previously cached key in that namespace
   * without a Redis SCAN, at the cost of orphaned keys that just expire
   * on their own TTL.
   *
   * Redis reads/writes fail open (a hiccup falls back to calling `fn`
   * rather than breaking the request) — but `fn` itself is called
   * outside that try/catch, so a business-logic error it throws (e.g.
   * NotFoundException) propagates normally instead of being mistaken
   * for a cache failure and silently retried.
   */
  async getOrSet<T>(namespace: string, key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cacheKey = await this.buildKey(namespace, key);

    if (cacheKey) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as T;
      } catch (err) {
        this.logger.warn(`cache read failed for ${cacheKey}, falling back to source`, err as Error);
      }
    }

    const fresh = await fn();

    if (cacheKey) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(fresh), "EX", ttlSeconds);
      } catch (err) {
        this.logger.warn(`cache write failed for ${cacheKey}`, err as Error);
      }
    }

    return fresh;
  }

  async bumpVersion(namespace: string): Promise<void> {
    try {
      await this.redis.incr(`${namespace}:v`);
    } catch (err) {
      this.logger.warn(`failed to bump cache version for ${namespace}`, err as Error);
    }
  }

  private async buildKey(namespace: string, key: string): Promise<string | null> {
    try {
      const version = await this.redis.get(`${namespace}:v`);
      return `${namespace}:${version ?? 0}:${key}`;
    } catch (err) {
      this.logger.warn(`failed to read cache version for ${namespace}, skipping cache`, err as Error);
      return null;
    }
  }
}
