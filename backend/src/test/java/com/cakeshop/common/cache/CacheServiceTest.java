package com.cakeshop.common.cache;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/**
 * CacheService / CacheClient 单元测试
 * 测试环境走 LOCAL (Caffeine)
 */
@SpringBootTest
@ActiveProfiles("test")
class CacheServiceTest {

    @Autowired
    private CacheClient cache;

    @Autowired
    private CacheService cacheService;

    @Test
    void testBasicKv() {
        String key = "test:basic:" + System.nanoTime();
        cache.set(key, "hello");
        assertEquals("hello", cache.get(key));
        assertTrue(cache.has(key));
        assertEquals(1L, cache.del(key));
        assertNull(cache.get(key));
    }

    @Test
    void testExpire() {
        // 用 TTL 检查接口验证
        String key = "test:exp:" + System.nanoTime();
        cache.setEx(key, "value", 60, TimeUnit.SECONDS);
        assertEquals("value", cache.get(key));
        // TTL 返回值大于 0
        Long ttl = cache.ttl(key, TimeUnit.SECONDS);
        assertNotNull(ttl);
        assertTrue(ttl > 0);
        cache.del(key);
    }

    @Test
    void testIncrDecr() {
        String key = "test:incr:" + System.nanoTime();
        assertEquals(1L, cache.incr(key, 1L));
        assertEquals(5L, cache.incr(key, 4L));
        assertEquals(3L, cache.decr(key, 2L));
        cache.del(key);
    }

    @Test
    void testHash() {
        String key = "test:hash:" + System.nanoTime();
        cache.hset(key, "field1", "v1");
        cache.hset(key, "field2", "v2");
        assertEquals("v1", cache.hget(key, "field1"));
        assertEquals("v2", cache.hget(key, "field2"));
        assertEquals(2, cache.hgetAll(key).size());
        cache.del(key);
    }

    @Test
    void testList() {
        String key = "test:list:" + System.nanoTime();
        cache.lpush(key, "a", "b", "c");
        assertEquals(3, cache.lrange(key, 0, -1).size());
        // Local 实现的 lpop/rpop 迭代顺序不保证
        // 只验证 size 正确
        cache.del(key);
    }

    @Test
    void testSet() {
        String key = "test:set:" + System.nanoTime();
        cache.sadd(key, "x", "y", "z");
        assertEquals(3, cache.smembers(key).size());
        assertEquals(1L, cache.srem(key, "x"));
        assertEquals(2, cache.smembers(key).size());
        cache.del(key);
    }

    @Test
    void testRateLimit() {
        String key = "test:rate:" + System.nanoTime();
        assertTrue(cacheService.allowRequest(key, 3, 10));
        assertTrue(cacheService.allowRequest(key, 3, 10));
        assertTrue(cacheService.allowRequest(key, 3, 10));
        assertFalse(cacheService.allowRequest(key, 3, 10));
        cache.del("rate:" + key);
    }

    @Test
    void testLockUnlock() {
        String key = "test:lock:" + System.nanoTime();
        String id = cacheService.tryLock(key, 5);
        assertNotNull(id);
        assertTrue(cacheService.unlock(key, id));
        // 锁已释放,能再次获取
        String id2 = cacheService.tryLock(key, 5);
        assertNotNull(id2);
        assertTrue(cacheService.unlock(key, id2));
    }

    @Test
    void testBackend() {
        assertEquals("CAFFEINE", cache.backend());
        assertTrue(cache.ping());
    }

    @Test
    void testLocalCacheCompat() {
        // 验证兼容层 LocalCache.get/set/del 还能用
        String key = "test:compat:" + System.nanoTime();
        LocalCache.set(key, "v1", 60);
        String v = LocalCache.get(key, String.class);
        assertEquals("v1", v);
        LocalCache.del(key);
        assertNull(LocalCache.get(key, String.class));
    }
}
