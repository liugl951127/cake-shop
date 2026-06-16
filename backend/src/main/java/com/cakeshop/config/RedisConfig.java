package com.cakeshop.config;

import com.cakeshop.common.cache.LocalCache;
import lombok.extern.slf4j.Slf4j;
import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.net.ConnectException;
import java.util.concurrent.TimeUnit;

/**
 * Redis 配置 - 可选/降级
 *   1. 默认走 Redisson(生产)
 *   2. 若 Redis 不可用,降级到 LocalCache(开发/H2 环境)
 *   3. 启动时连接 3 次重试,失败不阻塞 Spring 启动
 */
@Slf4j
@Configuration
public class RedisConfig {

    @Value("${spring.redis.host:127.0.0.1}")
    private String host;
    @Value("${spring.redis.port:6379}")
    private int port;
    @Value("${spring.redis.password:}")
    private String password;
    @Value("${spring.redis.database:0}")
    private int database;
    @Value("${spring.redis.timeout:3000}")
    private int timeout;

    /**
     * RedissonClient
     *   - 当 cakeshop.redis.enabled=false 时,本 Bean 不注册
     *   - 默认 true;但若启动后连接失败,会回退到 LocalCache
     */
    @Bean(name = "redissonClient", destroyMethod = "shutdown")
    @ConditionalOnProperty(name = "cakeshop.redis.enabled", havingValue = "true", matchIfMissing = true)
    public RedissonClient redissonClient() {
        // 启动前先尝试 ping
        if (!tryConnect()) {
            log.warn("Redis 连不上,Redisson 跳过创建,降级到 LocalCache");
            return null;
        }
        Config config = new Config();
        String address = "redis://" + host + ":" + port;
        var single = config.useSingleServer()
                .setAddress(address)
                .setDatabase(database)
                .setConnectTimeout(timeout)
                .setRetryAttempts(3)
                .setRetryInterval(1000);
        if (password != null && !password.trim().isEmpty()) {
            single.setPassword(password);
        }
        try {
            RedissonClient client = Redisson.create(config);
            log.info("Redisson 启动: {} (db={})", address, database);
            return client;
        } catch (Exception e) {
            log.warn("Redisson 创建失败,降级到 LocalCache: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 尝试 TCP 连一下 Redis(不认证)
     */
    private boolean tryConnect() {
        for (int i = 0; i < 3; i++) {
            try (java.net.Socket socket = new java.net.Socket()) {
                socket.connect(new java.net.InetSocketAddress(host, port), 1000);
                log.info("Redis {}:{} 可达 (第 {} 次尝试)", host, port, i + 1);
                return true;
            } catch (Exception e) {
                log.warn("Redis {}:{} 第 {} 次连不上: {}", host, port, i + 1, e.getMessage());
                try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
            }
        }
        return false;
    }

    /**
     * 兜底 Bean:当 Redisson 没注册时,提供 LocalCache 作为替代
     *   通过 @Primary 让 Spring 优先注入 LocalCache
     */
    @Bean(name = "localCacheFallback")
    @ConditionalOnMissingBean(name = "redissonClient")
    @Primary
    public LocalCache localCacheFallback() {
        log.warn("⚠️ 使用 LocalCache 替代 Redis(进程内,重启数据丢失)");
        return new LocalCache();
    }
}
