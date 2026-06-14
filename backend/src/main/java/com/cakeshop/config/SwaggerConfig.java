package com.cakeshop.config;

import com.github.xiaoymin.knife4j.spring.annotations.EnableKnife4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import springfox.documentation.builders.ApiInfoBuilder;
import springfox.documentation.builders.PathSelectors;
import springfox.documentation.builders.RequestHandlerSelectors;
import springfox.documentation.service.ApiInfo;
import springfox.documentation.service.Contact;
import springfox.documentation.service.SecurityScheme;
import springfox.documentation.spi.DocumentationType;
import springfox.documentation.spring.web.plugins.Docket;
import springfox.documentation.swagger2.annotations.EnableSwagger2;

import java.util.Collections;

@Configuration
@EnableSwagger2
@EnableKnife4j
public class SwaggerConfig {

    @Bean
    public Docket api() {
        return new Docket(DocumentationType.SWAGGER_2)
            .apiInfo(apiInfo())
            .select()
            .apis(RequestHandlerSelectors.basePackage("com.cakeshop.controller"))
            .paths(PathSelectors.any())
            .build()
            .securitySchemes(Collections.singletonList(
                new springfox.documentation.service.ApiKey("Bearer", "Authorization", "header")
            ));
    }

    private ApiInfo apiInfo() {
        return new ApiInfoBuilder()
            .title("甜心蛋糕 - 管理后台 API")
            .description("Spring Boot 2.7 商家管理后台,集成微信云函数")
            .contact(new Contact("MiniMax", "https://github.com/liugl951127/cake-shop", "noreply@liugl"))
            .version("1.0.0")
            .build();
    }
}
