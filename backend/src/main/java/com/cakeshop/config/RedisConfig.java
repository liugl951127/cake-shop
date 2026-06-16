package com.cakeshop.config;

import com.cakeshop.common.cache.CacheClient;
import com.cakeshop.common.cache.CaffeineCacheClient;
import com.cakeshop.common.cache.RedisCacheClient;
import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.redisson.config.SentinelServersConfig;
import org.redisson.config.SingleServerConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Redis 配置 (v33 重构版)
 *
 * 设计原则:
 *   1. 与 redisson-spring-boot-starter 解耦(不依赖 starter 自动装配)
 *   2. 所有 Redis 连接参数统一从 spring.data.redis.* 读取(标准 Spring Boot 命名)
 *   3. 密码可空(空 = 无密码)
 *   4. 自动选择客户端: Lettuce (默认,高并发) / Jedis (老项目兼容)
 *   5. CacheClient 接口屏蔽实现差异
 *
 * 切换方式:
 *   - dev/test: cakeshop.cache.type=LOCAL (默认)
 *   - prod:     cakeshop.cache.type=REDIS
 *
 * 密码配置:
 *   application.yml:
 *     spring:
 *       data:
 *         redis:
 *           host: 127.0.0.1
 *           port: 6379
 *           password: ${REDIS_PASSWORD:}  # 空=无密码
 *
 * 依赖冲突规避:
 *   - 不 @Bean RedissonClient(交给 starter)
 *   - 我们手写 Redisson 客户端,与 starter 完全解耦
 *   - 启动时只创建所需 bean,dev/test 不会尝试连 Redis
 */
@Slf4j
@Configuration
public class RedisConfig {

    // ======== 基础配置 ========
    @Value("${spring.data.redis.host:127.0.0.1}")
    private String host;

    @Value("${spring.data.redis.port:6379}")
    private int port;

    @Value("${spring.data.redis.password:}")
    private String password;

    @Value("${spring.data.redis.timeout:3000ms}")
    private Duration timeout;

    @Value("${spring.data.redis.database:0}")
    private int database;

    @Value("${spring.data.redis.lettuce.pool.max-active:50}")
    private int maxActive;

    @Value("${spring.data.redis.lettuce.pool.max-idle:10}")
    private int maxIdle;

    @Value("${spring.data.redis.lettuce.pool.min-idle:2}")
    private int minIdle;

    @Value("${spring.data.redis.lettuce.pool.max-wait:2000ms}")
    private Duration maxWait;

    @Value("${spring.data.redis.sentinel.master:}")
    private String sentinelMaster;

    @Value("${spring.data.redis.sentinel.nodes:}")
    private String sentinelNodes;

    // ======== 自定义配置 ========
    @Value("${cakeshop.cache.type:LOCAL}")
    private String cacheType;

    @Value("${cakeshop.cache.local.max-size:10000}")
    private long localMaxSize;

    @Value("${cakeshop.cache.local.default-ttl-minutes:10}")
    private long localDefaultTtlMinutes;

    // ============================================================
    // 1. Lettuce ConnectionFactory (Spring Data Redis 用的)
    // ============================================================
    @Bean(name = "redisConnectionFactory", destroyMethod = "destroy")
    @ConditionalOnProperty(name = "cakeshop.cache.type", havingValue = "REDIS")
    public LettuceConnectionFactory redisConnectionFactory() {
        log.info("=====================================================");
        log.info("= 启动 Redis 模式 (host={}, port={}, db={}, password={})", host, port, database, maskPassword(password));
        log.info("=====================================================");

        RedisStandaloneConfiguration standaloneConfig = new RedisStandaloneConfiguration();
        standaloneConfig.setHostName(host);
        standaloneConfig.setPort(port);
        standaloneConfig.setDatabase(database);
        // 密码: 为空不设置,避免某些服务端拒绝空密码
        if (password != null && !password.isEmpty()) {
            standaloneConfig.setPassword(RedisPassword.of(password));
        }

        // Lettuce 客户端配置 (带连接池)
        LettuceClientConfiguration clientConfig = LettuceClientConfiguration.builder()
                .commandTimeout(timeout)
                .clientOptions(buildClientOptions())
                .build();

        LettuceConnectionFactory factory = new LettuceConnectionFactory(standaloneConfig, clientConfig);
        factory.setShareNativeConnection(true);
        factory.setEagerInitialization(false);
        return factory;
    }

    private io.lettuce.core.ClientOptions buildClientOptions() {
        return io.lettuce.core.ClientOptions.builder()
                .autoReconnect(true)
                .disconnectedBehavior(io.lettuce.core.ClientOptions.DisconnectedBehavior.REJECT_COMMANDS)
                .socketOptions(io.lettuce.core.SocketOptions.builder()
                        .keepAlive(true)
                        .connectTimeout(timeout)
                        .build())
                .timeoutOptions(io.lettuce.core.TimeoutOptions.enabled(timeout))
                .build();
    }

    // ============================================================
    // 2. StringRedisTemplate (基础 KV)
    // ============================================================
    @Bean(name = "stringRedisTemplate")
    @ConditionalOnProperty(name = "cakeshop.cache.type", havingValue = "REDIS")
    public StringRedisTemplate stringRedisTemplate(@Autowired RedisConnectionFactory factory) {
        StringRedisTemplate template = new StringRedisTemplate();
        template.setConnectionFactory(factory);
        template.setEnableTransactionSupport(false);
        template.afterPropertiesSet();
        return template;
    }

    // ============================================================
    // 3. RedisTemplate<String, Object> (Object 序列化)
    // ============================================================
    @Bean(name = "redisTemplate")
    @ConditionalOnProperty(name = "cakeshop.cache.type", havingValue = "REDIS")
    public RedisTemplate<String, Object> redisTemplate(@Autowired RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        StringRedisSerializer keySer = new StringRedisSerializer();
        GenericJackson2JsonRedisSerializer valSer = new GenericJackson2JsonRedisSerializer(buildObjectMapper());

        template.setKeySerializer(keySer);
        template.setHashKeySerializer(keySer);
        template.setValueSerializer(valSer);
        template.setHashValueSerializer(valSer);
        template.setEnableTransactionSupport(false);
        template.afterPropertiesSet();
        return template;
    }

    private ObjectMapper buildObjectMapper() {
        ObjectMapper om = new ObjectMapper();
        om.registerModule(new JavaTimeModule());
        om.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);
        om.activateDefaultTyping(om.getPolymorphicTypeValidator(),
            ObjectMapper.DefaultTyping.NON_FINAL);
        return om;
    }

    // ============================================================
    // 4. RedissonClient (分布式锁)
    //    不依赖 starter,我们手写 (避免与 redisson-spring-boot-starter 冲突)
    // ============================================================
    @Bean(name = "redissonClient", destroyMethod = "shutdown")
    @ConditionalOnClass(Redisson.class)
    @ConditionalOnProperty(name = "cakeshop.cache.type", havingValue = "REDIS")
    public RedissonClient redissonClient() {
        Config config = new Config();

        // Sentinel 模式
        if (sentinelMaster != null && !sentinelMaster.isEmpty()
                && sentinelNodes != null && !sentinelNodes.isEmpty()) {
            SentinelServersConfig sc = config.useSentinelServers()
                    .setMasterName(sentinelMaster)
                    .addSentinelAddress(sentinelNodes.split(","))
                    .setDatabase(database)
                    .setConnectTimeout((int) timeout.toMillis())
                    .setTimeout((int) timeout.toMillis());
            if (password != null && !password.isEmpty()) {
                sc.setPassword(password);
            }
            log.info("[REDIS] Redisson Sentinel: master={}, nodes={}", sentinelMaster, sentinelNodes);
        }
        // 单机模式
        else {
            SingleServerConfig sc = config.useSingleServer()
                    .setAddress("redis://" + host + ":" + port)
                    .setDatabase(database)
                    .setConnectionPoolSize(maxActive)
                    .setConnectionMinimumIdleSize(minIdle)
                    .setIdleConnectionTimeout(10_000)
                    .setConnectTimeout((int) timeout.toMillis())
                    .setTimeout((int) timeout.toMillis());
            if (password != null && !password.isEmpty()) {
                sc.setPassword(password);
            }
            log.info("[REDIS] Redisson 单机: {}:{}", host, port);
        }
        return Redisson.create(config);
    }

    // ============================================================
    // 5. CacheClient 统一门面
    //    - REDIS 模式: RedisCacheClient
    //    - LOCAL 模式: CaffeineCacheClient
    // ============================================================
    @Bean(name = "cacheClient", destroyMethod = "close")
    @Primary
    public CacheClient cacheClient(
            @Autowired(required = false) StringRedisTemplate stringRedis,
            @Autowired(required = false) RedisTemplate<String, Object> jsonRedis,
            @Autowired(required = false) RedissonClient redisson) {

        if ("REDIS".equalsIgnoreCase(cacheType)) {
            if (stringRedis == null) {
                throw new IllegalStateException("REDIS 模式但缺少 StringRedisTemplate,请检查 cakeshop.cache.type 配置");
            }
            log.info("=====================================================");
            log.info("= CacheClient -> RedisCacheClient (生产)             =");
            log.info("=====================================================");
            return new RedisCacheClient(stringRedis, jsonRedis, redisson);
        } else {
            log.info("=====================================================");
            log.info("= CacheClient -> CaffeineCacheClient (dev/test 进程内) =");
            log.info("= ⚠️  生产环境请设置 cakeshop.cache.type=REDIS       =");
            log.info("=====================================================");
            return new CaffeineCacheClient(localMaxSize, Duration.ofMinutes(localDefaultTtlMinutes));
        }
    }

    // ============================================================
    // 6. 健康检查
    // ============================================================
    @Bean(name = "cacheHealthIndicator")
    public CacheHealthIndicator cacheHealthIndicator(@Autowired CacheClient cacheClient) {
        return new CacheHealthIndicator(cacheClient);
    }

    public static class CacheHealthIndicator {
        private final CacheClient client;

        public CacheHealthIndicator(CacheClient client) {
            this.client = client;
            String status = client.ping() ? "OK" : "DOWN";
            log.info("[HEALTH] 缓存健康检查: backend={}, ping={}", client.backend(), status);
        }

        public Map<String, Object> status() {
            Map<String, Object> map = new HashMap<>();
            map.put("backend", client.backend());
            map.put("ping", client.ping());
            return map;
        }
    }

    // ============================================================
    // 工具
    // ============================================================
    private String maskPassword(String pwd) {
        if (pwd == null || pwd.isEmpty()) return "(empty)";
        if (pwd.length() <= 2) return "**";
        return pwd.charAt(0) + "***" + pwd.charAt(pwd.length() - 1);
    }
}
