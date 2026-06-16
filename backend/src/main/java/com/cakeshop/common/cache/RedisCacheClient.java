package com.cakeshop.common.cache;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * Redis 缓存客户端 (生产)
 *
 * 集成:
 *   - Spring Data Redis (RedisTemplate / StringRedisTemplate)
 *   - Redisson (分布式锁)
 *   - Jackson (Object 序列化)
 *
 * 密码支持:
 *   - spring.data.redis.password 可为空(无密码)
 *   - 为空时不会传 auth,避免某些服务端拒绝
 *   - 密码错误会拋 RedisConnectionFailureException,启动时 fail-fast
 *
 * 连接池:
 *   - Lettuce (默认,Netty NIO,单连接可复用)
 *   - 配合 commons-pool2 启用连接池
 *
 * 序列化:
 *   - Key: StringRedisSerializer
 *   - Value: Jackson2JsonRedisSerializer (Object) / StringRedisSerializer (String)
 *   - Hash: String 字段名 + Jackson Value
 */
@Slf4j
public class RedisCacheClient implements CacheClient {

    private final StringRedisTemplate stringRedis;
    private final RedisTemplate<String, Object> jsonRedis;
    private final RedissonClient redisson;
    private final ObjectMapper jackson = new ObjectMapper();

    public RedisCacheClient(StringRedisTemplate stringRedis,
                            RedisTemplate<String, Object> jsonRedis,
                            RedissonClient redisson) {
        this.stringRedis = stringRedis;
        this.jsonRedis = jsonRedis;
        this.redisson = redisson;
        log.info("[CACHE] Redis 缓存客户端初始化完成 (Redisson 分布式锁已就绪)");
    }

    // ============== 基本 ==============
    @Override
    public String get(String key) {
        return stringRedis.opsForValue().get(key);
    }

    @Override
    public void set(String key, String value) {
        stringRedis.opsForValue().set(key, value);
    }

    @Override
    public void setEx(String key, String value, long timeout, TimeUnit unit) {
        stringRedis.opsForValue().set(key, value, timeout, unit);
    }

    @Override
    public Boolean has(String key) {
        return stringRedis.hasKey(key);
    }

    @Override
    public Long del(String... keys) {
        return stringRedis.delete(Arrays.asList(keys));
    }

    @Override
    public Long del(Collection<String> keys) {
        return stringRedis.delete(keys);
    }

    @Override
    public Boolean expire(String key, long timeout, TimeUnit unit) {
        return stringRedis.expire(key, timeout, unit);
    }

    @Override
    public Boolean expireAt(String key, long epochMilli) {
        return stringRedis.expireAt(key, new Date(epochMilli));
    }

    @Override
    public Long ttl(String key, TimeUnit unit) {
        return stringRedis.getExpire(key, unit);
    }

    // ============== 数值 ==============
    @Override
    public Long incr(String key, long delta) {
        return stringRedis.opsForValue().increment(key, delta);
    }

    @Override
    public Long decr(String key, long delta) {
        return stringRedis.opsForValue().decrement(key, delta);
    }

    // ============== 对象 ==============
    @Override
    public <T> T getObject(String key, Class<T> type) {
        Object v = jsonRedis.opsForValue().get(key);
        if (v == null) return null;
        if (type.isInstance(v)) return type.cast(v);
        // 兼容: 存的是 JSON 字符串
        try {
            return jackson.readValue(v.toString(), type);
        } catch (Exception e) {
            log.warn("getObject 反序列化失败: {} -> {}", key, v);
            return null;
        }
    }

    @Override
    public void setObject(String key, Object value) {
        jsonRedis.opsForValue().set(key, value);
    }

    @Override
    public void setObject(String key, Object value, long timeout, TimeUnit unit) {
        jsonRedis.opsForValue().set(key, value, timeout, unit);
    }

    // ============== 哈希 ==============
    @Override
    public Long hset(String key, String field, String value) {
        stringRedis.opsForHash().put(key, field, value);
        return 1L;
    }

    @Override
    public String hget(String key, String field) {
        Object v = stringRedis.opsForHash().get(key, field);
        return v == null ? null : v.toString();
    }

    @Override
    public Map<String, String> hgetAll(String key) {
        HashOperations<String, String, String> ops = stringRedis.opsForHash();
        Map<String, String> entries = ops.entries(key);
        return entries == null ? new HashMap<>() : entries;
    }

    @Override
    public Long hdel(String key, String... fields) {
        return stringRedis.opsForHash().delete(key, (Object[]) fields);
    }

    // ============== 列表 ==============
    @Override
    public Long lpush(String key, String... values) {
        return stringRedis.opsForList().leftPushAll(key, values);
    }

    @Override
    public Long rpush(String key, String... values) {
        return stringRedis.opsForList().rightPushAll(key, values);
    }

    @Override
    public String lpop(String key) {
        return stringRedis.opsForList().leftPop(key);
    }

    @Override
    public String rpop(String key) {
        return stringRedis.opsForList().rightPop(key);
    }

    @Override
    public List<String> lrange(String key, long start, long stop) {
        return stringRedis.opsForList().range(key, start, stop);
    }

    // ============== 集合 ==============
    @Override
    public Long sadd(String key, String... members) {
        return stringRedis.opsForSet().add(key, members);
    }

    @Override
    public Set<String> smembers(String key) {
        Set<String> members = stringRedis.opsForSet().members(key);
        return members == null ? new HashSet<>() : members;
    }

    @Override
    public Long srem(String key, String... members) {
        return stringRedis.opsForSet().remove(key, (Object[]) members);
    }

    // ============== 有序集合 ==============
    @Override
    public Long zadd(String key, double score, String member) {
        Boolean ok = stringRedis.opsForZSet().add(key, member, score);
        return ok == null ? 0L : (ok ? 1L : 0L);
    }

    @Override
    public List<String> zrange(String key, long start, long stop) {
        Set<String> set = stringRedis.opsForZSet().range(key, start, stop);
        return set == null ? new ArrayList<>() : new ArrayList<>(set);
    }

    // ============== 扫描 ==============
    @Override
    public Set<String> keys(String pattern) {
        return stringRedis.keys(pattern);
    }

    // ============== 分布式锁 ==============
    @Override
    public String tryLock(String key, long leaseTime, TimeUnit unit) {
        if (redisson == null) {
            log.warn("Redisson 不可用,分布式锁退化为 SETNX");
            return tryLockSimple(key, leaseTime, unit);
        }
        RLock lock = redisson.getLock(key);
        try {
            boolean ok = lock.tryLock(0, leaseTime, unit);
            return ok ? Thread.currentThread().getName() + ":" + System.nanoTime() : null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Redisson tryLock 被中断: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public Boolean unlock(String key, String lockId) {
        if (redisson == null) {
            // 简单实现: SET key value NX PX
            String script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
            Long r = stringRedis.execute((org.springframework.data.redis.core.RedisCallback<Long>) c ->
                c.scriptingCommands().eval(script.getBytes(),
                    org.springframework.data.redis.connection.ReturnType.INTEGER,
                    1, key.getBytes(), (lockId == null ? "" : lockId).getBytes()));
            return r != null && r > 0;
        }
        RLock lock = redisson.getLock(key);
        if (lock.isHeldByCurrentThread()) {
            lock.unlock();
            return true;
        }
        return false;
    }

    private String tryLockSimple(String key, long leaseTime, TimeUnit unit) {
        String token = UUID.randomUUID().toString();
        Boolean ok = stringRedis.opsForValue().setIfAbsent(key, token, leaseTime, unit);
        return Boolean.TRUE.equals(ok) ? token : null;
    }

    // ============== 健康检查 ==============
    @Override
    public boolean ping() {
        try {
            String pong = stringRedis.execute((org.springframework.data.redis.core.RedisCallback<String>) RedisConnection::ping);
            return "PONG".equalsIgnoreCase(pong);
        } catch (Exception e) {
            log.warn("Redis ping 失败: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public String backend() {
        return "REDIS";
    }

    @Override
    public void close() {
        // Spring 容器会负责关闭,这里不主动关
    }
}
