package com.cakeshop.config;

import com.cakeshop.security.TenantInterceptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web 配置
 *   - 后台管理端 H5 静态资源
 *   - 根路径 / -> 跳登录
 *   - 多租户拦截器(对 /api/** 生效)
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Autowired private TenantInterceptor tenantInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(tenantInterceptor)
            .addPathPatterns("/api/**")
            .excludePathPatterns(
                "/api/auth/login",
                "/api/auth/refresh",
                "/api/doc.html",
                "/api/swagger-ui/**",
                "/api/v3/api-docs/**",
                "/api/v2/api-docs/**",
                "/api/webjars/**"
            );
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
            .addResourceLocations("classpath:/admin-h5/")
            .setCachePeriod(3600);
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/pages/login/login.html");
        registry.addViewController("/admin").setViewName("forward:/pages/dashboard/dashboard.html");
    }
}
