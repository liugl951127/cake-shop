package com.cakeshop.config;

import com.cakeshop.common.cache.LocalCache;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.concurrent.TimeUnit;

/**
 * Redis 配置(简化版 - 不与 starter 冲突)
 *
 * 设计:
 *   - RedissonClient 由 redisson-spring-boot-starter 自动配置
 *   - 我们的 application-dev.yml 中关闭 Redisson 自动配置 + 走 LocalCache
 *   - 本类只做 health check + LocalCache 兜底
 *
 * 切换说明:
 *   1. dev/test:  application-{profile}.yml 加 autoconfigure.exclude 排除 Redisson
 *   2. prod:      application-prod.yml 不排除,自动用 Redis
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

    /**
     * 启动前 TCP ping(检查 Redis 是否可达)
     *   只在 Redisson 自动配置**启用**时(生产环境)检查
     *   dev/test 排除了自动配置,这个 Bean 不会执行
     */
    @Bean
    @ConditionalOnProperty(name = "cakeshop.redis.enabled", havingValue = "true", matchIfMissing = false)
    public RedisHealthChecker redisHealthChecker() {
        if (!tryConnect()) {
            throw new IllegalStateException(String.format(
                "Redis %s:%d 不可用。请检查:\n" +
                "  1. Redis 服务是否启动 (docker run -d -p 6379:6379 redis:7-alpine)\n" +
                "  2. spring.redis.host/port 是否正确\n" +
                "  3. 或设置 cakeshop.redis.enabled=false 走 LocalCache",
                host, port
            ));
        }
        return new RedisHealthChecker();
    }

    /**
     * LocalCache 兜底 Bean
     *   - 只在 dev/test 启用(Redsion 被排除时)
     *   - 业务代码可同时注入 RedissonClient 和 LocalCache,选其一
     */
    @Bean(name = "localCacheFallback")
    @ConditionalOnProperty(name = "cakeshop.redis.enabled", havingValue = "false")
    public LocalCache localCacheFallback() {
        log.warn("======================================================");
        log.warn("= 使用 LocalCache 替代 Redis (进程内,重启数据丢失) =");
        log.warn("= 生产环境请设置 cakeshop.redis.enabled=true      =");
        log.warn("======================================================");
        return new LocalCache();
    }

    private boolean tryConnect() {
        for (int i = 0; i < 3; i++) {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), 1500);
                log.info("Redis {}:{} 可达(第 {} 次)", host, port, i + 1);
                return true;
            } catch (Exception e) {
                log.warn("Redis {}:{} 第 {} 次连不上: {}", host, port, i + 1, e.getMessage());
                try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
            }
        }
        return false;
    }

    public static class RedisHealthChecker {
        // 占位,只为了让 @Bean 触发
    }
}
