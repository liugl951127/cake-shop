package com.cakeshop;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * 甜心蛋糕 - Spring Boot 后台启动类
 *
 * 职责: 给商家用的管理后台(RBAC、订单/商品/财务/风控)
 * 通信: REST API + 集成微信云函数(cloudfunctions/...)通过 HTTP trigger
 *
 * @author MiniMax
 */
@SpringBootApplication
@MapperScan("com.cakeshop.repository")
@EnableTransactionManagement
@EnableCaching
@EnableAsync
@EnableScheduling
public class CakeshopBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(CakeshopBackendApplication.class, args);
    }
}
