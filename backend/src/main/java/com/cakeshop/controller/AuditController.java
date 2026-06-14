package com.cakeshop.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cakeshop.audit.AuditAspect;
import com.cakeshop.common.Result;
import com.cakeshop.entity.AuditLog;
import com.cakeshop.repository.AuditLogRepository;
import com.cakeshop.security.TenantContext;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/audit")
@Tag(name = "审计中心")
public class AuditController {

    @Autowired private AuditLogRepository auditLogRepository;

    @GetMapping
    @Operation(summary = "审计日志查询")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'READONLY')")
    public Result<Page<AuditLog>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String action,
        @RequestParam(required = false) String targetType,
        @RequestParam(required = false) String targetId,
        @RequestParam(required = false) String operatorId,
        @RequestParam(required = false) String severity,
        @RequestParam(required = false) Long startTs,
        @RequestParam(required = false) Long endTs
    ) {
        LambdaQueryWrapper<AuditLog> w = new LambdaQueryWrapper<AuditLog>()
            .orderByDesc(AuditLog::getTs);
        if (action != null) w.eq(AuditLog::getAction, action);
        if (targetType != null) w.eq(AuditLog::getTargetType, targetType);
        if (targetId != null) w.eq(AuditLog::getTargetId, targetId);
        if (operatorId != null) w.eq(AuditLog::getOperatorId, operatorId);
        if (severity != null) w.eq(AuditLog::getSeverity, severity);
        if (startTs != null) w.ge(AuditLog::getTs, startTs);
        if (endTs != null) w.le(AuditLog::getTs, endTs);
        return Result.ok(auditLogRepository.selectPage(new Page<>(page, size), w));
    }

    @GetMapping("/{id}/replay")
    @Operation(summary = "操作回放 - 返回 before/after diff")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Map<String, Object>> replay(@PathVariable Long id) {
        AuditLog a = auditLogRepository.selectById(id);
        if (a == null) return Result.fail(com.cakeshop.common.ErrorCode.NOT_FOUND.getCode(), "审计不存在");
        // 简单 diff
        Map<String, Object> result = new HashMap<>();
        result.put("audit", a);
        result.put("before", a.getBeforeState());
        result.put("after", a.getAfterState());
        result.put("replayable", Boolean.TRUE.equals(a.getReplayable()));
        return Result.ok(result);
    }

    @GetMapping("/dashboard")
    @Operation(summary = "审计大盘 - 关键操作统计")
    public Result<Map<String, Object>> dashboard() {
        Map<String, Object> r = new HashMap<>();
        // 最近 24h
        long dayAgo = System.currentTimeMillis() - 24 * 60 * 60 * 1000;
        r.put("total24h", auditLogRepository.selectCount(
            new LambdaQueryWrapper<AuditLog>().ge(AuditLog::getTs, dayAgo)));
        r.put("fail24h", auditLogRepository.selectCount(
            new LambdaQueryWrapper<AuditLog>().ge(AuditLog::getTs, dayAgo).eq(AuditLog::getResult, "fail")));
        // 关键操作 top
        r.put("topActions", topActions());
        return Result.ok(r);
    }

    private List<Map<String, Object>> topActions() {
        // 简化:直接列表(生产用 SQL group by)
        return auditLogRepository.selectList(
            new LambdaQueryWrapper<AuditLog>()
                .orderByDesc(AuditLog::getTs)
                .last("LIMIT 50")
        ).stream().map(a -> {
            Map<String, Object> m = new HashMap<>();
            m.put("action", a.getAction());
            m.put("targetType", a.getTargetType());
            m.put("ts", a.getTs());
            m.put("result", a.getResult());
            return m;
        }).toList();
    }
}
