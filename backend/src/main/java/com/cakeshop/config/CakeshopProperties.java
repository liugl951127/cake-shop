package com.cakeshop.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 自定义业务配置(application.yml -> cakeshop.*)
 */
@Data
@Component
@ConfigurationProperties(prefix = "cakeshop")
public class CakeshopProperties {

    private Business business = new Business();
    private Security security = new Security();
    private Rbac rbac = new Rbac();
    private Wechat wechat = new Wechat();

    @Data
    public static class Business {
        private Double commissionRate = 0.05;
        private Integer minWithdraw = 100;
        private Integer maxWithdraw = 50000;
        private Integer orderExpireMinutes = 30;
        private Integer autoConfirmDays = 7;
    }

    @Data
    public static class Security {
        private String jwtSecret;
        private Long jwtTtl = 604800000L;
        private String jwtHeader = "Authorization";
        private String jwtPrefix = "Bearer ";
        private List<String> ignoreUrls;
    }

    @Data
    public static class Rbac {
        private List<String> superAdmin;
        private List<String> admin;
        private List<String> operator;
        private List<String> finance;
        private List<String> customerService;
        private List<String> readonly;
    }

    @Data
    public static class Wechat {
        private Cloudbase cloudbase = new Cloudbase();

        @Data
        public static class Cloudbase {
            private String envId;
            private String apiBase;
            private Integer timeoutMs = 8000;
        }
    }
}
