package com.cakeshop.common.cache;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 进程内本地缓存(开发/测试用)
 *   - 生产请用 Redis
 *   - 自动过期清理
 */
public class LocalCache {
    private static final ConcurrentHashMap<String, Entry> STORE = new ConcurrentHashMap<>();
    private static final ScheduledExecutorService CLEANER = Executors.newSingleThreadScheduledExecutor(
            r -> {
                Thread t = new Thread(r, "local-cache-cleaner");
                t.setDaemon(true);
                return t;
            });

    static {
        CLEANER.scheduleAtFixedRate(() -> {
            long now = System.currentTimeMillis();
            STORE.entrySet().removeIf(e -> e.getValue().expireAt < now);
        }, 30, 30, TimeUnit.SECONDS);
    }

    private static class Entry {
        Object value;
        long expireAt;
        Entry(Object v, long exp) {
            this.value = v;
            this.expireAt = exp;
        }
    }

    @SuppressWarnings("unchecked")
    public static <T> T get(String key, Class<T> type) {
        Entry e = STORE.get(key);
        if (e == null) return null;
        if (e.expireAt < System.currentTimeMillis()) {
            STORE.remove(key);
            return null;
        }
        return (T) e.value;
    }

    public static void set(String key, Object value, int ttlSeconds) {
        long exp = ttlSeconds > 0
                ? System.currentTimeMillis() + ttlSeconds * 1000L
                : Long.MAX_VALUE;
        STORE.put(key, new Entry(value, exp));
    }

    public static void del(String key) {
        STORE.remove(key);
    }

    public static boolean has(String key) {
        Entry e = STORE.get(key);
        if (e == null) return false;
        if (e.expireAt < System.currentTimeMillis()) {
            STORE.remove(key);
            return false;
        }
        return true;
    }

    public static void clear() {
        STORE.clear();
    }
}
