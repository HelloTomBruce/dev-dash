import { exec } from "../exec";
import type { ActionExecutor } from "../types";
import {
  PG_PROTECTED_DBS,
  validateDbName,
  validateRedisDb,
  validateRedisKey,
} from "../validators";

/** 数据库类动作：PostgreSQL / Redis */
export const databaseExecutors: Record<string, ActionExecutor> = {
  "pg.createdb": (p) => exec("pg.createdb", `createdb ${validateDbName(p)}`, 30_000),
  "pg.dropdb": (p) => {
    const db = validateDbName(p);
    if (PG_PROTECTED_DBS.has(db)) {
      throw new Error(`系统数据库不可删除: ${db}`);
    }
    return exec("pg.dropdb", `dropdb ${db}`, 30_000);
  },

  "redis.del-key": (p) =>
    exec("redis.del-key", `redis-cli del "${validateRedisKey(p)}"`, 15_000),
  "redis.flushdb": (p) =>
    exec("redis.flushdb", `redis-cli -n ${validateRedisDb(p)} flushdb`, 15_000),
};
