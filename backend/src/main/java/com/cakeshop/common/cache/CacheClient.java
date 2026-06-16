package com.cakeshop.common.cache;

import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * 缓存统一门面
 *
 * 业务代码只依赖此接口,不关心实现是 Redis 还是 LocalCache
 * - 生产: RedisCacheClient (Redisson + Lettuce + Spring Data Redis)
 * - dev/test: CaffeineCacheClient (进程内)
 *
 * 为什么不直接用 Spring Cache:
 *   1. 我们要明确控制 Redis / LocalCache 切换场景
 *   2. 业务要求明确“get/set/del/expire/lock”原子语义
 *   3. 本地缓存不能像 Redis 那样集群
 *
 * 方法说明:
 *   - get / set: 读写基本 KV
 *   - setEx: 带过期时间写入
 *   - del: 删除 1 个或多个 key
 *   - has: 判断存在
 *   - expire: 设置过期
 *   - ttl: 查剩余过期
 *   - incr / decr: 原子增减
 *   - keys: 查以 prefix 为前缀的所有 key
 *   - scan: 扫描 key (生产环境避免 keys)
 *   - hget / hset: 哈希表操作
 *   - hgetAll / hdel: 哈希表查询/删除
 *   - lpush / rpush / lpop / rpop / lrange: 列表操作
 *   - sadd / smembers / srem: 集合操作
 *   - zadd / zrange: 有序集合
 *   - expireAt: 绝对时间过期
 */
public interface CacheClient {

    // ============== 基本 ==============
    String get(String key);

    void set(String key, String value);

    void setEx(String key, String value, long timeout, TimeUnit unit);

    Boolean has(String key);

    Long del(String... keys);

    Long del(Collection<String> keys);

    Boolean expire(String key, long timeout, TimeUnit unit);

    Boolean expireAt(String key, long epochMilli);

    Long ttl(String key, TimeUnit unit);

    // ============== 数值 ==============
    Long incr(String key, long delta);

    Long decr(String key, long delta);

    // ============== 通用 KV (Object 序列化) ==============
    <T> T getObject(String key, Class<T> type);

    void setObject(String key, Object value);

    void setObject(String key, Object value, long timeout, TimeUnit unit);

    // ============== 哈希 ==============
    Long hset(String key, String field, String value);

    String hget(String key, String field);

    Map<String, String> hgetAll(String key);

    Long hdel(String key, String... fields);

    // ============== 列表 ==============
    Long lpush(String key, String... values);

    Long rpush(String key, String... values);

    String lpop(String key);

    String rpop(String key);

    java.util.List<String> lrange(String key, long start, long stop);

    // ============== 集合 ==============
    Long sadd(String key, String... members);

    Set<String> smembers(String key);

    Long srem(String key, String... members);

    // ============== 有序集合 ==============
    Long zadd(String key, double score, String member);

    java.util.List<String> zrange(String key, long start, long stop);

    // ============== 扫描 ==============
    Set<String> keys(String pattern);

    // ============== 分布式锁 ==============
    /**
     * 尝试加锁
     * @return lockId (用于解锁) 或 null (获取失败)
     */
    String tryLock(String key, long leaseTime, TimeUnit unit);

    /**
     * 释放锁
     * @param key 锁名
     * @param lockId  tryLock 返回的 ID
     * @return 释放成功 / 失败
     */
    Boolean unlock(String key, String lockId);

    // ============== 健康检查 ==============
    /**
     * PING 检查
     * @return true 可用
     */
    boolean ping();

    /**
     * 当前后端名 (REDIS / LOCAL_CAFFEINE / NULL)
     */
    String backend();

    /**
     * 关闭连接
     */
    void close();
}
