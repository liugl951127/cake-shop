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

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * 客户端异常上报(简化 - 走云函数)
 * 这里作为后台独立端点,留作扩展
 */
@Slf4j
@RestController
@RequestMapping("/client-errors")
@Tag(name = "客户端异常上报")
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
}
