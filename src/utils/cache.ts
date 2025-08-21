import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { debug } from "./logger";
import {
  getClaudePaths,
  findProjectPaths,
  getFileModificationDate,
} from "./claude";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CacheManager {
  private static readonly CACHE_DIR = path.join(
    homedir(),
    ".claude",
    "powerline"
  );
  private static readonly USAGE_CACHE_DIR = path.join(this.CACHE_DIR, "usage");
  private static readonly LOCKS_DIR = path.join(this.CACHE_DIR, "locks");

  private static isLocked(name: string): boolean {
    const lockFile = path.join(this.LOCKS_DIR, name);
    return fs.existsSync(lockFile);
  }

  private static async acquireLock(
    name: string,
    timeout = 5000
  ): Promise<boolean> {
    const RETRY_DELAY_MS = 50;
    const FILE_CREATE_FLAG = "wx";

    await this.ensureCacheDirectories();
    const lockFile = path.join(this.LOCKS_DIR, name);
    const startTime = Date.now();
    const lockContent = String(process.pid);

    while (Date.now() - startTime < timeout) {
      try {
        await fs.promises.writeFile(lockFile, lockContent, {
          flag: FILE_CREATE_FLAG,
        });
        debug(`Lock acquired for ${name}`);
        return true;
      } catch (error: any) {
        if (error.code === "EEXIST") {
          await setTimeout(RETRY_DELAY_MS);
        } else {
          throw error;
        }
      }
    }
    debug(`Failed to acquire lock for ${name} within ${timeout}ms`);
    return false;
  }

  private static async releaseLock(name: string): Promise<void> {
    const lockFile = path.join(this.LOCKS_DIR, name);
    try {
      await fs.promises.unlink(lockFile);
      debug(`Lock released for ${name}`);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        debug(`Error releasing lock for ${name}:`, error);
      }
    }
  }

  static async ensureCacheDirectories(): Promise<void> {
    try {
      await Promise.all([
        fs.promises.mkdir(this.CACHE_DIR, { recursive: true }),
        fs.promises.mkdir(this.USAGE_CACHE_DIR, { recursive: true }),
        fs.promises.mkdir(this.LOCKS_DIR, { recursive: true }),
      ]);
    } catch (error) {
      debug("Failed to create cache directories:", error);
    }
  }

  static createProjectHash(projectPath: string): string {
    return createHash("md5").update(projectPath).digest("hex").substring(0, 8);
  }

  static async getUsageCache(
    cacheType: "today" | "block" | "pricing",
    latestMtime?: number
  ): Promise<any | null> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 75;
    const FILE_ENCODING = "utf-8";

    await this.ensureCacheDirectories();
    const cachePath = path.join(this.USAGE_CACHE_DIR, `${cacheType}.json`);
    const lockName = `${cacheType}.usage.lock`;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const isCurrentlyLocked = this.isLocked(lockName);
      if (isCurrentlyLocked) {
        debug(`Cache for ${cacheType} is locked, waiting...`);
        await setTimeout(RETRY_DELAY_MS);
        continue;
      }

      try {
        const content = await fs.promises.readFile(cachePath, FILE_ENCODING);
        const cached: CacheEntry<any> = JSON.parse(content);
        const cacheIsValid = !latestMtime || cached.timestamp >= latestMtime;

        if (cacheIsValid) {
          debug(`[CACHE-HIT] ${cacheType} disk cache: found`);
          return this.deserializeDates(cached.data);
        } else {
          debug(
            `${cacheType} cache outdated: cache=${cached.timestamp}, latest=${latestMtime}`
          );
          return null;
        }
      } catch (error: any) {
        if (error.code === "ENOENT") {
          debug(`No shared ${cacheType} usage cache found`);
          return null;
        }
        const attemptNumber = attempt + 1;
        debug(
          `Attempt ${attemptNumber} failed to read ${cacheType} cache: ${error.message}. Retrying...`
        );
        await setTimeout(RETRY_DELAY_MS);
      }
    }

    debug(`Failed to read ${cacheType} cache after ${MAX_RETRIES} attempts.`);
    return null;
  }

  private static deserializeDates(data: any): any {
    if (Array.isArray(data)) {
      return data.map((entry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    }
    return data;
  }

  static async setUsageCache(
    cacheType: "today" | "block" | "pricing",
    data: any,
    latestMtime?: number
  ): Promise<void> {
    const lockName = `${cacheType}.usage.lock`;
    const lockAcquired = await this.acquireLock(lockName);
    if (!lockAcquired) {
      debug(`Could not acquire lock to set usage cache for ${cacheType}`);
      return;
    }

    try {
      await this.ensureCacheDirectories();
      const cachePath = path.join(this.USAGE_CACHE_DIR, `${cacheType}.json`);
      const cacheTimestamp = latestMtime || Date.now();
      const cacheEntry: CacheEntry<any> = {
        data,
        timestamp: cacheTimestamp,
      };
      const cacheContent = JSON.stringify(cacheEntry);

      await fs.promises.writeFile(cachePath, cacheContent, "utf-8");
      debug(`[CACHE-SET] ${cacheType} disk cache stored`);
    } catch (error) {
      debug(`Failed to save ${cacheType} usage cache:`, error);
    } finally {
      await this.releaseLock(lockName);
    }
  }

  static async getLatestTranscriptMtime(): Promise<number> {
    try {
      const claudePaths = getClaudePaths();
      const projectPaths = await findProjectPaths(claudePaths);

      let latestMtime = 0;

      for (const projectPath of projectPaths) {
        try {
          const files = await fs.promises.readdir(projectPath);
          const jsonlFiles = files.filter((file) => file.endsWith(".jsonl"));

          for (const file of jsonlFiles) {
            const filePath = path.join(projectPath, file);
            const mtime = await getFileModificationDate(filePath);
            if (mtime && mtime.getTime() > latestMtime) {
              latestMtime = mtime.getTime();
            }
          }
        } catch (error) {
          debug(`Failed to read project directory ${projectPath}:`, error);
          continue;
        }
      }

      return latestMtime;
    } catch (error) {
      debug("Failed to get latest transcript mtime:", error);
      return Date.now();
    }
  }
}
