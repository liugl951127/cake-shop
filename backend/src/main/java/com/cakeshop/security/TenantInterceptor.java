package com.cakeshop.security;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.entity.Tenant;
import com.cakeshop.repository.TenantRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

/**
 * 多租户拦截器
 *   - 解析 X-Tenant-Id / Authorization 中的 tenant
 *   - 校验租户状态: disabled / 过期 / 额度
 *   - 注入到 TenantContext
 */
@Slf4j
@Component
public class TenantInterceptor implements HandlerInterceptor {

    @Autowired private TenantRepository tenantRepository;

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        String tenantId = req.getHeader("X-Tenant-Id");
        if (!StringUtils.hasText(tenantId)) {
            tenantId = req.getParameter("tenantId");
        }
        if (!StringUtils.hasText(tenantId)) {
            tenantId = "default";
        }

        Tenant tenant = tenantRepository.findByCode(tenantId);
        if (tenant == null) {
            // 允许 "default" 兜底
            if ("default".equals(tenantId)) {
                TenantContext.set("default", "default", defaultTenantInfo());
                return true;
            }
            throw new BizException(ErrorCode.TENANT_NOT_FOUND);
        }
        if ("disabled".equals(tenant.getStatus())) {
            throw new BizException(ErrorCode.TENANT_DISABLED);
        }
        if (tenant.getExpireAt() != null && tenant.getExpireAt() < System.currentTimeMillis()) {
            throw new BizException(ErrorCode.TENANT_EXPIRED);
        }

        Map<String, Object> info = new HashMap<>();
        info.put("id", tenant.getId());
        info.put("code", tenant.getCode());
        info.put("name", tenant.getName());
        info.put("plan", tenant.getPlan());
        TenantContext.set(tenant.getCode(), tenant.getCode(), info);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest req, HttpServletResponse res, Object handler, Exception ex) {
        TenantContext.clear();
    }

    private Map<String, Object> defaultTenantInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("id", 0L);
        info.put("code", "default");
        info.put("name", "默认租户");
        info.put("plan", "enterprise");
        return info;
    }
}
