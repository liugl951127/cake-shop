package com.cakeshop.controller;

import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import com.cakeshop.entity.ErrorReport;
import com.cakeshop.repository.ErrorReportRepository;
import com.cakeshop.security.TenantContext;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * 客户端上报 - 异常 + 行为埋点
 *  v36.0: 异常上报
 *  v36.1: 行为埋点(替代云函数 sendBehaviorLog)
 */
@Slf4j
@RestController
@RequestMapping("/client-errors")
@Tag(name = "客户端上报")
public class ClientErrorController {

    @Autowired private ErrorReportRepository errorRepository;
    private static final ConcurrentMap<String, Long> DEDUP = new ConcurrentHashMap<>();
    private static final long DEDUP_WINDOW = 5 * 60 * 1000;

    @PostMapping
    @Operation(summary = "上报异常(5分钟同指纹去重)")
    public Result<Map<String, Object>> report(@RequestBody Map<String, Object> body) {
        String message = (String) body.get("message");
        String stack = (String) body.getOrDefault("stack", "");
        if (message == null || message.isEmpty()) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "message 必填");
        }
        if (message.length() > 2000) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "message 过长");
        }

        // 指纹
        String stackLine = stack.split("\n").length > 1 ? stack.split("\n")[1] : "";
        String fingerprint = (message + "|" + stackLine).hashCode() + "";
        long now = System.currentTimeMillis();
        Long last = DEDUP.get(fingerprint);
        if (last != null && now - last < DEDUP_WINDOW) {
            return Result.ok(Map.of("deduped", true));
        }
        DEDUP.put(fingerprint, now);

        ErrorReport r = new ErrorReport();
        r.setFingerprint(fingerprint);
        r.setMessage(message);
        r.setStack(stack.length() > 4000 ? stack.substring(0, 4000) : stack);
        r.setType((String) body.getOrDefault("type", "Error"));
        r.setScene((String) body.getOrDefault("scene", "client"));
        r.setLevel((String) body.getOrDefault("level", "error"));
        r.setContext(body.getOrDefault("context", null) != null
            ? body.get("context").toString() : null);
        r.setTenantId(TenantContext.getCurrent());
        r.setUserId((String) body.getOrDefault("userId", ""));
        r.setDeviceId((String) body.getOrDefault("deviceId", ""));
        r.setCount(1);
        r.setTs(now);
        errorRepository.insert(r);
        return Result.ok(Map.of("id", r.getId(), "deduped", false));
    }

    /**
     * 客户端行为埋点上报(v36.1+)
     *  用 request.js 直连后端,不再调云函数
     *  输入: { logs: [...], sessionId, deviceId, scene, userId, openid }
     *  答: 批量入库到 error_report(当作 Info 级别)
     */
    @PostMapping("/behavior")
    @Operation(summary = "客户端行为埋点(批量)")
    public Result<Map<String, Object>> behavior(@RequestBody Map<String, Object> body) {
        Object logsObj = body.get("logs");
        if (!(logsObj instanceof List)) {
            return Result.ok(Map.of("accepted", 0));
        }
        List<?> logs = (List<?>) logsObj;
        int accepted = 0;
        for (Object o : logs) {
            if (!(o instanceof Map)) continue;
            Map<?, ?> m = (Map<?, ?>) o;
            try {
                ErrorReport r = new ErrorReport();
                String type = m.get("type") == null ? "" : m.get("type").toString();
                r.setType(type);
                r.setLevel("info");
                r.setScene("behavior");
                r.setMessage(type);
                r.setFingerprint(m.get("element") == null ? "" : m.get("element").toString());
                r.setContext(m.get("payload") == null ? null : m.get("payload").toString());
                r.setDeviceId(str(body.get("deviceId")));
                r.setUserId(str(body.get("userId")));
                r.setTenantId(TenantContext.getCurrent());
                r.setCount(1);
                Object ts = m.get("ts");
                r.setTs(ts == null ? System.currentTimeMillis() : Long.valueOf(ts.toString()));
                errorRepository.insert(r);
                accepted++;
            } catch (Exception e) {
                log.warn("[behavior] insert fail: {}", e.getMessage());
            }
        }
        return Result.ok(Map.of("accepted", accepted));
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }
}
