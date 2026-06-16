# Redis 配置指南

## 概述

本项目对 Redis 进行了**完全重构**,实现以下目标:

1. ✅ **统一门面** (`CacheClient`): 业务代码不关心底层是 Redis 还是本地缓存
2. ✅ **密码支持**: 通过环境变量 `REDIS_PASSWORD` 注入,支持空密码
3. ✅ **包兼容**: pom 中 Redisson 设为 `optional`,不与 starter 冲突
4. ✅ **多客户端**: Lettuce (默认,Netty 高并发) + 可选 Jedis
5. ✅ **集群支持**: Sentinel 模式开箱即用

## 架构

```
┌─────────────────────────────────────────────┐
│  业务代码 (PaymentCryptoService / Token…)   │
│         ↓ 注入                              │
│    ┌────────────────────┐                   │
│    │   CacheService     │ 业务级封装        │
│    └────────┬───────────┘                   │
│             ↓                               │
│    ┌────────────────────┐                   │
│    │   CacheClient      │ 统一门面 (接口)   │
│    └────────┬───────────┘                   │
│             ↓                               │
│   ┌─────────┴──────────┐                    │
│   ↓                    ↓                    │
│ RedisCacheClient   CaffeineCacheClient      │
│ (生产 - 真实 Redis) (dev/test - 进程内)     │
└─────────────────────────────────────────────┘
```

## 切换缓存后端

通过 `cakeshop.cache.type` 控制:

```yaml
# application-dev.yml
cakeshop:
  cache:
    type: LOCAL     # 走 Caffeine 进程内缓存,无需 Redis

# application-prod.yml
cakeshop:
  cache:
    type: REDIS     # 走真实 Redis
```

## 密码配置

### 优先级
1. **环境变量 `REDIS_PASSWORD`** (推荐,生产必用)
2. **YAML 字段** (开发可临时用)
3. **空字符串** = 无密码

### 示例

```yaml
spring:
  data:
    redis:
      host: 127.0.0.1
      port: 6379
      password: ${REDIS_PASSWORD:}    # 留空 = 无密码
      database: 0
      timeout: 3000ms
      lettuce:
        pool:
          max-active: 50
          max-idle: 10
          min-idle: 2
          max-wait: 2000ms
```

### 环境变量启动

```bash
# 无密码
java -jar backend.jar

# 有密码
REDIS_PASSWORD=mySecret123 java -jar backend.jar

# Sentinel 集群
REDIS_SENTINEL_MASTER=mymaster \
REDIS_SENTINEL_NODES=10.0.0.1:26379,10.0.0.2:26379 \
java -jar backend.jar
```

## 客户端选择

### Lettuce (默认推荐)

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>
```

- **基于 Netty NIO**,单连接复用
- **连接池**: 通过 commons-pool2 启用
- **自动重连**: `autoReconnect: true`
- **超时**: 可配置

### Redisson (分布式锁)

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.32.0</version>
    <optional>true</optional>   <!-- 关键:不与 starter 冲突 -->
</dependency>
```

- 分布式锁、限流器 (RRateLimiter)、发布订阅
- 我们手写 `RedissonClient` bean(不依赖 starter 自动配置)
- 启动时根据 `cakeshop.cache.type=REDIS` 决定是否创建

## 包兼容性矩阵

| 依赖组合 | 是否兼容 | 说明 |
|---------|---------|------|
| `spring-boot-starter-data-redis` + `redisson-spring-boot-starter` (默认) | ✅ 兼容 | 我们不引入冲突的 `@Bean RedissonClient`,由我们的 `RedisConfig` 统一管 |
| `spring-boot-starter-data-redis` + `redisson-spring-data-XX` (单独引入) | ✅ 兼容 | Redisson 自己有一套 Spring Data 集成,也能用 |
| 多个 `RedissonClient` Bean | ❌ 报错 | 我们手写避免 |
| 排除 Redisson 自动配置 + 我们的 RedisConfig | ✅ 兼容 | dev/test 默认走这条路 |

## 排除冲突的策略

`application-dev.yml` 中主动排除 Redisson 自动配置:

```yaml
spring:
  autoconfigure:
    exclude:
      - org.redisson.spring.starter.RedissonAutoConfigurationV2
      - org.redisson.spring.starter.RedissonAutoConfiguration
      - org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration
```

## CacheClient 接口

业务代码只依赖此接口,完整方法列表见 `CacheClient.java`:

- **基本**: `get`, `set`, `setEx`, `has`, `del`, `expire`, `expireAt`, `ttl`
- **数值**: `incr`, `decr`
- **对象**: `getObject`, `setObject` (带 JSON 序列化)
- **哈希**: `hset`, `hget`, `hgetAll`, `hdel`
- **列表**: `lpush`, `rpush`, `lpop`, `rpop`, `lrange`
- **集合**: `sadd`, `smembers`, `srem`
- **有序集合**: `zadd`, `zrange`
- **扫描**: `keys` (生产慎用,可用 `scan`)
- **分布式锁**: `tryLock`, `unlock`
- **健康检查**: `ping`, `backend`

## 业务使用示例

```java
@Service
public class OrderService {
    @Autowired
    private CacheService cache;
    
    public Order getOrLoad(String orderId) {
        return cache.getOrLoad("order:" + orderId, 300, Order.class, () -> {
            return orderRepository.findById(orderId).orElse(null);
        });
    }
    
    public boolean checkRateLimit(String userId) {
        return cache.allowRequest("rate:order:" + userId, 10, 60);
    }
    
    public void payWithLock(String orderId, Runnable action) {
        String lockId = cache.tryLock("pay:lock:" + orderId, 30);
        if (lockId == null) {
            throw new BizException(ErrorCode.SYSTEM_BUSY, "订单正在处理中");
        }
        try {
            action.run();
        } finally {
            cache.unlock("pay:lock:" + orderId, lockId);
        }
    }
}
```

## 兼容旧 API

`LocalCache` 兼容层保留旧的静态方法,自动委托到 `CacheClient`:

```java
// 旧代码 - 还能用
LocalCache.get(key, Long.class);
LocalCache.set(key, value, 600);
LocalCache.del(key);

// 新代码 - 推荐
@Autowired CacheClient cache;
cache.get(key);
cache.setEx(key, value, 600, TimeUnit.SECONDS);
cache.del(key);
```

## 启动检查

启动时会自动:
- 读取 `cakeshop.cache.type` 决定后端
- REDIS 模式: 创建 `RedisCacheClient` + 测试 `ping`
- LOCAL 模式: 创建 `CaffeineCacheClient` + 打印警告

```
=====================================================
= 启动 Redis 模式 (host=127.0.0.1, port=6379, db=0, password=**)
=====================================================
[HEALTH] 缓存健康检查: backend=REDIS, ping=true
```

## 测试

```bash
# 单元测试
mvn -Dspring.profiles.active=test test

# 测试结果
Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
- testBasicKv
- testExpire
- testIncrDecr
- testHash
- testList
- testSet
- testRateLimit
- testLockUnlock
- testBackend
- testLocalCacheCompat
```

## 故障排查

### 启动报错 `RedisConnectionFailureException`

- 检查 `REDIS_HOST` / `REDIS_PORT` 是否正确
- 检查密码是否正确
- 检查 Redis 服务是否启动
- 临时改用 LOCAL: `CACHE_TYPE=LOCAL`

### Lettuce 超时

- 调大 `timeout`: `spring.data.redis.timeout: 5000ms`
- 调大 `lettuce.pool.max-wait`

### Redisson 锁死

- 检查 `tryLock` 的 `leaseTime` 不要太长
- 用 `unlock(key, lockId)` 释放,别用 `forceUnlock`

## 版本

- Spring Boot: 2.7.18
- Spring Data Redis: 2.7.x
- Lettuce: 6.x
- Redisson: 3.32.0
- Caffeine: 3.1.8
