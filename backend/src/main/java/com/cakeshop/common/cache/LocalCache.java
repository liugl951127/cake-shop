package com.cakeshop.common.cache;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 兼容层 - 让旧代码 LocalCache.get(key, Class) 还能用
 *
 * 实际底层走 CacheClient (Caffeine 或 Redis)
 *   - 旧静态方法委托给 bean
 *   - 新代码直接用 CacheClient / CacheService
 */
@Slf4j
@Component
public class LocalCache {

    private static CacheClient staticDelegate;

    @Autowired
    public void setCacheClient(CacheClient client) {
        LocalCache.staticDelegate = client;
        log.info("[CACHE] LocalCache 兼容层已绑定 -> {}", client.backend());
    }

    private static CacheClient d() {
        if (staticDelegate == null) {
            throw new IllegalStateException("LocalCache 未初始化,容器可能未启动");
        }
        return staticDelegate;
    }

    // ============== 兼容旧 API ==============
    @SuppressWarnings("unchecked")
    public static <T> T get(String key, Class<T> type) {
        if (type == Long.class) {
            String v = d().get(key);
            return v == null ? null : (T) Long.valueOf(v);
        }
        if (type == Integer.class) {
            String v = d().get(key);
            return v == null ? null : (T) Integer.valueOf(v);
        }
        if (type == String.class) {
            return (T) d().get(key);
        }
        if (type == Map.class) {
            return (T) d().hgetAll(key);
        }
        // Object: 走 JSON
        return d().getObject(key, type);
    }

    public static void set(String key, Object value, int ttlSeconds) {
        if (value == null) {
            d().setEx(key, "", ttlSeconds, TimeUnit.SECONDS);
            return;
        }
        if (value instanceof String) {
            d().setEx(key, (String) value, ttlSeconds, TimeUnit.SECONDS);
        } else if (value instanceof Number) {
            d().setEx(key, value.toString(), ttlSeconds, TimeUnit.SECONDS);
        } else if (value instanceof Map) {
            // 旧 Map 用 hash 表
            d().del(key);
            Map<?, ?> m = (Map<?, ?>) value;
            for (Map.Entry<?, ?> e : m.entrySet()) {
                d().hset(key, e.getKey().toString(), e.getValue() == null ? "" : e.getValue().toString());
            }
            if (ttlSeconds > 0) d().expire(key, ttlSeconds, TimeUnit.SECONDS);
        } else {
            d().setObject(key, value, ttlSeconds, TimeUnit.SECONDS);
        }
    }

    public static void del(String key) {
        d().del(key);
    }

    public static boolean has(String key) {
        return Boolean.TRUE.equals(d().has(key));
    }

    public static void clear() {
        // 没法全清,各 key 自管理
    }
}
