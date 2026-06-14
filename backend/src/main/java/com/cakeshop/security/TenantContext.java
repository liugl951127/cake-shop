package com.cakeshop.security;

import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.BizException;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;

/**
 * 多租户上下文(ThreadLocal)
 *   - 请求开始: TenantInterceptor 设置
 *   - 业务层: TenantContext.getCurrent() 拿当前租户
 *   - 请求结束: 清空
 *
 * 数据隔离:
 *   - 实体带 tenantId 字段,Repository 查询自动加 where tenant_id=?
 *   - 跨租户访问抛 TENANT_ISOLATION_DENIED
 */
@Slf4j
public class TenantContext {
    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();
    private static final ThreadLocal<String> CODE = new ThreadLocal<>();
    private static final ThreadLocal<Map<String, Object>> INFO = new ThreadLocal<>();

    public static void set(String tenantId, String code, Map<String, Object> info) {
        CURRENT.set(tenantId);
        CODE.set(code);
        INFO.set(info == null ? new HashMap<>() : info);
    }

    public static String getCurrent() {
        return CURRENT.get() == null ? "default" : CURRENT.get();
    }

    public static String getCode() {
        return CODE.get();
    }

    public static Map<String, Object> getInfo() {
        return INFO.get();
    }

    public static void clear() {
        CURRENT.remove();
        CODE.remove();
        INFO.remove();
    }

    public static void require() {
        if (getCurrent() == null) {
            throw new BizException(ErrorCode.TENANT_NOT_FOUND);
        }
    }

    public static void assertSame(String tenantId) {
        if (tenantId == null) return;
        if (!tenantId.equals(getCurrent())) {
            throw new BizException(ErrorCode.TENANT_ISOLATION_DENIED);
        }
    }
}
