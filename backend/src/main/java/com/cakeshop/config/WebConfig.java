package com.cakeshop.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web 配置
 *   - 后台管理端 H5 静态资源托管(classpath:/admin-h5/)
 *   - 根路径 / -> 自动跳后台登录页
 *   - SPA 路由兜底: 未匹配的路径走 index.html
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 后台 H5 静态资源
        registry.addResourceHandler("/**")
            .addResourceLocations("classpath:/admin-h5/")
            .setCachePeriod(3600);
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // 根路径跳后台
        registry.addViewController("/").setViewName("forward:/pages/login/login.html");
        registry.addViewController("/admin").setViewName("forward:/pages/dashboard/dashboard.html");
    }
}
