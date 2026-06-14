package com.cakeshop.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.Map;

/**
 * Spring Boot 启动自检
 *   - 数据源连通
 *   - Bean 数量(防止漏配)
 *   - 关键 Service 注入
 *
 * 任何失败: log.error + 不阻断启动(让运维能进 actuator 排查)
 */
@Slf4j
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class StartupSanityCheck implements ApplicationListener<ApplicationReadyEvent> {

    @Autowired private DataSource dataSource;
    @Autowired(required = false) private CakeshopProperties cakeshopProperties;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        log.info("=".repeat(60));
        log.info("🎂 甜心蛋糕 Spring Boot 启动自检");
        log.info("=".repeat(60));

        // 1. 数据源
        try (Connection conn = dataSource.getConnection()) {
            log.info("✅ DataSource 连通: {}", conn.getMetaData().getURL());
        } catch (Exception e) {
            log.error("❌ DataSource 不可用: {}", e.getMessage());
        }

        // 2. Bean 统计
        Map<String, Object> beans = event.getApplicationContext().getBeansOfType(Object.class);
        int controllerCount = event.getApplicationContext().getBeanNamesForAnnotation(
            org.springframework.web.bind.annotation.RestController.class).length;
        int serviceCount = event.getApplicationContext().getBeanNamesForAnnotation(
            org.springframework.stereotype.Service.class).length;
        int repositoryCount = event.getApplicationContext().getBeanNamesForAnnotation(
            org.springframework.stereotype.Repository.class).length;
        int mapperCount = 0;
        try {
            mapperCount = event.getApplicationContext().getBeanNamesForType(
                org.apache.ibatis.annotations.Mapper.class).length;
        } catch (Exception e) { /* 忽略 */ }

        log.info("📦 Bean 总数: {}", beans.size());
        log.info("   - @RestController: {}", controllerCount);
        log.info("   - @Service: {}", serviceCount);
        log.info("   - @Repository: {}", repositoryCount);
        log.info("   - @Mapper: {}", mapperCount);

        // 3. 配置项
        if (cakeshopProperties != null) {
            log.info("⚙️  cakeshop.business.commissionRate: {}",
                cakeshopProperties.getBusiness().getCommissionRate());
        }

        // 4. 环境
        String[] profiles = event.getApplicationContext().getEnvironment().getActiveProfiles();
        log.info("🌐 Active profiles: {}", profiles.length == 0 ? "default" : String.join(",", profiles));

        log.info("=".repeat(60));
        log.info("🎂 启动完成");
        log.info("=".repeat(60));
    }
}
