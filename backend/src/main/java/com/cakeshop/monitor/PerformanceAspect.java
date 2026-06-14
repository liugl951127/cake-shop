package com.cakeshop.monitor;

import com.cakeshop.entity.PerformanceMetric;
import com.cakeshop.repository.PerformanceMetricRepository;
import com.cakeshop.security.TenantContext;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 性能监控切面
 *   - 记录 controller/service 方法的 latency
 *   - 失败上报
 *   - 入 performance_metrics 表
 */
@Slf4j
@Aspect
@Component
public class PerformanceAspect {

    @Autowired private PerformanceMetricRepository metricRepository;

    @Around("execution(* com.cakeshop.controller..*(..))")
    public Object aroundController(ProceedingJoinPoint pjp) throws Throwable {
        return measure(pjp, "controller");
    }

    @Around("execution(* com.cakeshop.service..*(..))")
    public Object aroundService(ProceedingJoinPoint pjp) throws Throwable {
        return measure(pjp, "service");
    }

    private Object measure(ProceedingJoinPoint pjp, String layer) throws Throwable {
        long start = System.currentTimeMillis();
        boolean success = true;
        String errorMsg = "";
        try {
            return pjp.proceed();
        } catch (Throwable t) {
            success = false;
            errorMsg = t.getMessage();
            throw t;
        } finally {
            try {
                long cost = System.currentTimeMillis() - start;
                PerformanceMetric m = new PerformanceMetric();
                m.setName(layer + ".latency");
                m.setValue((double) cost);
                Map<String, Object> tags = new HashMap<>();
                tags.put("class", pjp.getSignature().getDeclaringTypeName());
                tags.put("method", pjp.getSignature().getName());
                tags.put("success", String.valueOf(success));
                if (!success) tags.put("error", errorMsg);
                try {
                    m.setTags(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(tags));
                } catch (Exception e) { m.setTags("{}"); }
                m.setTenantId(TenantContext.getCurrent());
                m.setTs(System.currentTimeMillis());
                metricRepository.insert(m);
            } catch (Exception e) {
                PerformanceAspect.log.warn("metric log fail: {}", e.getMessage());
            }
        }
    }
}
