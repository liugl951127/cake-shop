package com.cakeshop.common.cache;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * 业务级缓存服务
 *
 * 在 CacheClient 之上提供:
 *   - 防穿透: 空值也缓存
 *   - 限流 (计数器)
 *   - 分布式锁
 *   - 通用 KV
 *
 * 业务代码注入 CacheService,不直接接触 CacheClient
 */
@Slf4j
@Service
public class CacheService {

    @Autowired
    private CacheClient cache;

    // ============== 防穿透 ==============
    public <T> T getOrLoad(String key, int ttlSeconds, Class<T> type, Supplier<T> loader) {
        T cached = cache.getObject(key, type);
        if (cached != null) return cached;
        T fresh = loader.get();
        cache.setObject(key, fresh, ttlSeconds, TimeUnit.SECONDS);
        return fresh;
    }

    // ============== 限流 (滑动窗口) ==============
    public boolean allowRequest(String key, int maxCount, int windowSeconds) {
        String k = "rate:" + key;
        Long current = cache.incr(k, 1L);
        if (current != null && current == 1L) {
            cache.expire(k, windowSeconds, TimeUnit.SECONDS);
        }
        return current != null && current <= maxCount;
    }

    // ============== 分布式锁 ==============
    public String tryLock(String key, int leaseSeconds) {
        return cache.tryLock(key, leaseSeconds, TimeUnit.SECONDS);
    }

    public boolean unlock(String key, String lockId) {
        return cache.unlock(key, lockId);
    }

    // ============== Token 缓存 ==============
    public void putToken(String token, String userId, int ttlSeconds) {
        cache.setEx("token:" + token, userId, ttlSeconds, TimeUnit.SECONDS);
    }

    public String getTokenUser(String token) {
        return cache.get("token:" + token);
    }

    public void invalidateToken(String token) {
        cache.del("token:" + token);
    }

    // ============== 后端 ==============
    public String backend() {
        return cache.backend();
    }
}
