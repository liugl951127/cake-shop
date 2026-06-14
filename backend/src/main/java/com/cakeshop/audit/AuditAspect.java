package com.cakeshop.audit;

import com.cakeshop.entity.AuditLog;
import com.cakeshop.repository.AuditLogRepository;
import com.cakeshop.security.LoginUser;
import com.cakeshop.security.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

/**
 * 操作审计切面
 *   - 标注 @Audited 的方法自动记录
 *   - 记录: action/target/operator/tenant/result/duration
 *
 * 用法:
 *   @Audited(action = "order.cancel", targetType = "order", targetArg = "orderId")
 *   public void cancel(Long orderId) { ... }
 */
@Slf4j
@Aspect
@Component
public class AuditAspect {

    @Autowired private AuditLogRepository auditLogRepository;
    private final ObjectMapper mapper = new ObjectMapper();

    @Around("@annotation(com.cakeshop.audit.Audited)")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        MethodSignature ms = (MethodSignature) pjp.getSignature();
        Method method = ms.getMethod();
        Audited anno = method.getAnnotation(Audited.class);

        long start = System.currentTimeMillis();
        String targetId = extractTarget(pjp, anno.targetArg());
        Object result = null;
        Throwable error = null;
        try {
            result = pjp.proceed();
            return result;
        } catch (Throwable t) {
            error = t;
            throw t;
        } finally {
            try {
                AuditLog log = new AuditLog();
                log.setAction(anno.action());
                log.setTargetType(anno.targetType());
                log.setTargetId(targetId);
                LoginUser u = currentUser();
                log.setOperatorId(u != null ? String.valueOf(u.getUserId()) : "system");
                log.setOperatorName(u != null ? (u.getOpenid() != null ? u.getOpenid() : "user#" + u.getUserId()) : "system");
                log.setOperatorRole(u != null ? u.getRole() : "anonymous");
                log.setTenantId(TenantContext.getCurrent());
                log.setSeverity(anno.severity());
                log.setResult(error == null ? "success" : "fail");
                log.setErrorMsg(error != null ? error.getMessage() : "");
                log.setTs(System.currentTimeMillis());
                Map<String, Object> detail = new HashMap<>();
                detail.put("method", method.getName());
                detail.put("class", method.getDeclaringClass().getSimpleName());
                detail.put("durationMs", System.currentTimeMillis() - start);
                try {
                    log.setDetail(mapper.writeValueAsString(detail));
                } catch (Exception e) { log.setDetail("{}"); }
                log.setReplayable(anno.replayable());
                auditLogRepository.insert(log);
            } catch (Exception e) {
                AuditAspect.log.warn("audit log fail: {}", e.getMessage());
            }
        }
    }

    private String extractTarget(ProceedingJoinPoint pjp, String argName) {
        if (argName == null || argName.isEmpty()) return "";
        try {
            MethodSignature ms = (MethodSignature) pjp.getSignature();
            String[] names = ms.getParameterNames();
            Object[] values = pjp.getArgs();
            for (int i = 0; i < names.length; i++) {
                if (argName.equals(names[i]) && values[i] != null) {
                    return String.valueOf(values[i]);
                }
            }
        } catch (Exception e) { /* ignore */ }
        return "";
    }

    private LoginUser currentUser() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof LoginUser) {
                return (LoginUser) auth.getPrincipal();
            }
        } catch (Exception e) { /* ignore */ }
        return null;
    }
}
