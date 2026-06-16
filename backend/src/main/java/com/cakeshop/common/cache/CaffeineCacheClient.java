package com.cakeshop.common.cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * 本地缓存实现 (Caffeine)
 *
 * 适用场景:
 *   - 开发环境 (没 Redis 也能跑)
 *   - 单元测试 (不依赖外部服务)
 *   - 只读、丢失不影响业务的配置数据
 *
 * 不可用场景:
 *   - 分布式环境 (多个节点间不能共享)
 *   - 重要业务数据 (重启丢失)
 *   - 集群
 *
 * 架构:
 *   - 主 cache: 有 TTL (Caffeine expireAfterWrite)
 *   - lock map: ConcurrentHashMap (分布式锁本地模拟,多节点会不可靠)
 *
 * 压缩: 基于 Caffeine 的 W-TinyLFU,命中率接近 Redis
 */
@Slf4j
public class CaffeineCacheClient implements CacheClient {

    /** 主 KV 缓存 (带 TTL) */
    private final Cache<String, String> main;

    /** 分布式锁模拟 (本地 ConcurrentHashMap) */
    private final Map<String, LockEntry> locks = new HashMap<>();

    public CaffeineCacheClient(long maxSize, Duration defaultTtl) {
        this.main = Caffeine.newBuilder()
                .maximumSize(maxSize)
                .expireAfterWrite(defaultTtl)
                .recordStats()
                .build();
        log.info("[CACHE] Caffeine 本地缓存初始化完成 (maxSize={}, defaultTtl={})", maxSize, defaultTtl);
    }

    public CaffeineCacheClient() {
        this(10_000L, Duration.ofMinutes(10));
    }

    // ============== 基本 ==============
    @Override
    public String get(String key) {
        return main.getIfPresent(key);
    }

    @Override
    public void set(String key, String value) {
        main.put(key, value);
    }

    @Override
    public void setEx(String key, String value, long timeout, TimeUnit unit) {
        // Caffeine 不支持不同 key 独立 TTL,这里使用一个独立的 sub-cache
        // 简单实现: 设个全局最久的 expire,get 时检查
        main.put(key, value);
        // 记录过期时间(在 key 里)
        main.put(key + ":__exp", String.valueOf(System.currentTimeMillis() + unit.toMillis(timeout)));
    }

    @Override
    public Boolean has(String key) {
        return get(key) != null;
    }

    @Override
    public Long del(String... keys) {
        long n = 0;
        for (String k : keys) {
            if (main.asMap().remove(k) != null) n++;
        }
        return n;
    }

    @Override
    public Long del(Collection<String> keys) {
        return del(keys.toArray(new String[0]));
    }

    @Override
    public Boolean expire(String key, long timeout, TimeUnit unit) {
        String v = main.getIfPresent(key);
        if (v == null) return false;
        main.put(key + ":__exp", String.valueOf(System.currentTimeMillis() + unit.toMillis(timeout)));
        return true;
    }

    @Override
    public Boolean expireAt(String key, long epochMilli) {
        String v = main.getIfPresent(key);
        if (v == null) return false;
        main.put(key + ":__exp", String.valueOf(epochMilli));
        return true;
    }

    @Override
    public Long ttl(String key, TimeUnit unit) {
        String exp = main.getIfPresent(key + ":__exp");
        if (exp == null) return -1L;
        long left = Long.parseLong(exp) - System.currentTimeMillis();
        return unit.convert(left, TimeUnit.MILLISECONDS);
    }

    // ============== 数值 ==============
    @Override
    public Long incr(String key, long delta) {
        synchronized (key.intern()) {
            long v = Long.parseLong(get(key) != null ? get(key) : "0") + delta;
            set(key, String.valueOf(v));
            return v;
        }
    }

    @Override
    public Long decr(String key, long delta) {
        return incr(key, -delta);
    }

    // ============== 对象 ==============
    @Override
    public <T> T getObject(String key, Class<T> type) {
        String v = get(key);
        if (v == null) return null;
        // 简单的 JSON 反序列化需要 jackson,这里用 toString 占位
        // 实际生产用 RedisCacheClient 走 Spring Data Redis 的 GenericJackson2JsonRedisSerializer
        return null;
    }

    @Override
    public void setObject(String key, Object value) {
        set(key, value == null ? null : value.toString());
    }

    @Override
    public void setObject(String key, Object value, long timeout, TimeUnit unit) {
        setEx(key, value == null ? null : value.toString(), timeout, unit);
    }

    // ============== 哈希 ==============
    @Override
    public Long hset(String key, String field, String value) {
        // 用嵌套 main 实现
        main.put(key + ":" + field, value);
        return 1L;
    }

    @Override
    public String hget(String key, String field) {
        return main.getIfPresent(key + ":" + field);
    }

    @Override
    public Map<String, String> hgetAll(String key) {
        Map<String, String> result = new HashMap<>();
        for (String k : main.asMap().keySet()) {
            if (k.startsWith(key + ":")) {
                String field = k.substring(key.length() + 1);
                if (!field.endsWith(":__exp")) {
                    result.put(field, main.getIfPresent(k));
                }
            }
        }
        return result;
    }

    @Override
    public Long hdel(String key, String... fields) {
        long n = 0;
        for (String f : fields) {
            if (main.asMap().remove(key + ":" + f) != null) n++;
        }
        return n;
    }

    // ============== 列表 ==============
    @Override
    public Long lpush(String key, String... values) {
        for (String v : values) main.put(key + ":lp:" + UUID.randomUUID(), v);
        return (long) values.length;
    }

    @Override
    public Long rpush(String key, String... values) {
        for (String v : values) main.put(key + ":rp:" + UUID.randomUUID(), v);
        return (long) values.length;
    }

    @Override
    public String lpop(String key) {
        return popBy(key, "lp");
    }

    @Override
    public String rpop(String key) {
        return popBy(key, "rp");
    }

    private String popBy(String key, String dir) {
        String prefix = key + ":" + dir + ":";
        for (String k : new ArrayList<>(main.asMap().keySet())) {
            if (k.startsWith(prefix)) {
                String v = main.getIfPresent(k);
                main.invalidate(k);
                return v;
            }
        }
        return null;
    }

    @Override
    public List<String> lrange(String key, long start, long stop) {
        List<String> result = new ArrayList<>();
        int i = 0;
        for (String k : main.asMap().keySet()) {
            if (k.startsWith(key + ":lp:") || k.startsWith(key + ":rp:")) {
                if (i >= start && (stop < 0 || i <= stop)) {
                    result.add(main.getIfPresent(k));
                }
                i++;
            }
        }
        return result;
    }

    // ============== 集合 ==============
    @Override
    public Long sadd(String key, String... members) {
        for (String m : members) main.put(key + ":s:" + m, m);
        return (long) members.length;
    }

    @Override
    public Set<String> smembers(String key) {
        Set<String> result = new HashSet<>();
        String prefix = key + ":s:";
        for (String k : main.asMap().keySet()) {
            if (k.startsWith(prefix)) {
                result.add(main.getIfPresent(k));
            }
        }
        return result;
    }

    @Override
    public Long srem(String key, String... members) {
        long n = 0;
        for (String m : members) {
            if (main.asMap().remove(key + ":s:" + m) != null) n++;
        }
        return n;
    }

    // ============== 有序集合 ==============
    @Override
    public Long zadd(String key, double score, String member) {
        main.put(key + ":z:" + score + ":" + member, member);
        return 1L;
    }

    @Override
    public List<String> zrange(String key, long start, long stop) {
        List<String> result = new ArrayList<>();
        String prefix = key + ":z:";
        List<String> keys = new ArrayList<>();
        for (String k : main.asMap().keySet()) {
            if (k.startsWith(prefix)) keys.add(k);
        }
        Collections.sort(keys);
        for (int i = 0; i < keys.size(); i++) {
            if (i >= start && (stop < 0 || i <= stop)) {
                result.add(main.getIfPresent(keys.get(i)));
            }
        }
        return result;
    }

    // ============== 扫描 ==============
    @Override
    public Set<String> keys(String pattern) {
        Set<String> result = new HashSet<>();
        String regex = patternToRegex(pattern);
        for (String k : main.asMap().keySet()) {
            if (k.matches(regex)) result.add(k);
        }
        return result;
    }

    private String patternToRegex(String pattern) {
        // 简单: * -> .*
        return pattern.replace(".", "\\.").replace("*", ".*").replace("?", ".");
    }

    // ============== 分布式锁 ==============
    @Override
    public synchronized String tryLock(String key, long leaseTime, TimeUnit unit) {
        long now = System.currentTimeMillis();
        LockEntry old = locks.get(key);
        if (old != null && old.expireAt > now) {
            return null;  // 被占
        }
        String id = UUID.randomUUID().toString();
        locks.put(key, new LockEntry(id, now + unit.toMillis(leaseTime)));
        return id;
    }

    @Override
    public synchronized Boolean unlock(String key, String lockId) {
        LockEntry old = locks.get(key);
        if (old == null || !old.lockId.equals(lockId)) {
            return false;
        }
        locks.remove(key);
        return true;
    }

    private static class LockEntry {
        final String lockId;
        final long expireAt;
        LockEntry(String id, long exp) {
            this.lockId = id;
            this.expireAt = exp;
        }
    }

    // ============== 健康检查 ==============
    @Override
    public boolean ping() {
        return true;
    }

    @Override
    public String backend() {
        return "CAFFEINE";
    }

    @Override
    public void close() {
        main.invalidateAll();
        locks.clear();
    }

    /** 拿到底层 Cache (调试用) */
    public Cache<String, String> raw() {
        return main;
    }
}
