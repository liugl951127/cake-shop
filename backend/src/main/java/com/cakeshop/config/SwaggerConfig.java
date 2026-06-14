package com.cakeshop.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.Components;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 3 配置(Spring Boot 2.7 / springdoc-openapi)
 *   - 取代 springfox(Spring Boot 2.6+ 不兼容)
 *   - UI 路径: /swagger-ui/index.html
 *   - JSON 路径: /v3/api-docs
 */
@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI cakeshopOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("甜心蛋糕 - 管理后台 API")
                .description("Spring Boot 2.7 商家管理后台,集成微信云函数")
                .version("1.0.0")
                .contact(new Contact()
                    .name("MiniMax")
                    .url("https://github.com/liugl951127/cake-shop")))
            .components(new Components()
                .addSecuritySchemes("Bearer",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")))
            .addSecurityItem(new SecurityRequirement().addList("Bearer"));
    }
}
