package com.cakeshop.controller;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 商家后台 - 财务管理
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/finance")
@Tag(name = "管理后台 - 财务")
public class AdminFinanceController {

    @GetMapping("/overview")
    @Operation(summary = "财务概览")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','FINANCE')")
    public Result<Map<String, Object>> overview(
        @RequestParam(required = false) Long startTime,
        @RequestParam(required = false) Long endTime
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("revenue", 0);
        data.put("refund", 0);
        data.put("net", 0);
        data.put("orderCount", 0);
        data.put("byDay", new HashMap<>());
        return Result.ok(data);
    }

    @GetMapping("/withdraws")
    @Operation(summary = "提现申请列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','FINANCE')")
    public Result<Map<String, Object>> withdraws(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) Integer status,
        @RequestParam(required = false) String userId
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("page", page);
        data.put("size", size);
        data.put("total", 0);
        data.put("list", List.of());
        return Result.ok(data);
    }

    @PostMapping("/withdraws/{id}/approve")
    @Operation(summary = "同意提现")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','FINANCE')")
    public Result<Map<String, Object>> approveWithdraw(@PathVariable String id) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", id);
        data.put("status", 1);
        return Result.ok(data);
    }

    @PostMapping("/withdraws/{id}/reject")
    @Operation(summary = "拒绝提现")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','FINANCE')")
    public Result<Map<String, Object>> rejectWithdraw(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", id);
        data.put("status", -1);
        return Result.ok(data);
    }

    @GetMapping("/settles")
    @Operation(summary = "商家结算列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','FINANCE')")
    public Result<Map<String, Object>> settles(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String merchantId
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("list", List.of());
        return Result.ok(data);
    }

    @PostMapping("/settles")
    @Operation(summary = "发起结算")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','FINANCE')")
    public Result<Map<String, Object>> createSettle(@RequestBody Map<String, Object> body) {
        if (body.get("merchantId") == null) throw new BizException(ErrorCode.BAD_REQUEST, "merchantId 必填");
        Map<String, Object> data = new HashMap<>();
        data.put("id", "settle-" + System.currentTimeMillis());
        return Result.ok(data);
    }

    @GetMapping("/bills")
    @Operation(summary = "账单列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','FINANCE')")
    public Result<Map<String, Object>> bills(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String userId,
        @RequestParam(required = false) Long startTime,
        @RequestParam(required = false) Long endTime
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("list", List.of());
        return Result.ok(data);
    }

    @PostMapping("/export")
    @Operation(summary = "导出账单(异步任务)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','FINANCE')")
    public Result<Map<String, Object>> export(@RequestBody Map<String, Object> body) {
        Map<String, Object> data = new HashMap<>();
        data.put("taskId", "task-" + System.currentTimeMillis());
        return Result.ok(data);
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
