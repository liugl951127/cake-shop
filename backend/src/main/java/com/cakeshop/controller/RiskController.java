package com.cakeshop.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cakeshop.common.Result;
import com.cakeshop.entity.RiskLog;
import com.cakeshop.service.RiskReviewService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/risk")
@Tag(name = "风控中心")
public class RiskController {

    @Autowired private RiskReviewService riskReviewService;

    @GetMapping("/pending")
    @Operation(summary = "待审列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE')")
    public Result<Page<RiskLog>> pending(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return Result.ok(riskReviewService.pending(new Page<>(page, size)));
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "审核通过")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE')")
    public Result<Void> approve(@PathVariable Long id, @RequestBody Map<String, String> body) {
        riskReviewService.approve(id, body.getOrDefault("note", ""));
        return Result.ok();
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "审核拒绝")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE')")
    public Result<Void> reject(@PathVariable Long id, @RequestBody Map<String, String> body) {
        riskReviewService.reject(id, body.getOrDefault("note", ""));
        return Result.ok();
    }

    @GetMapping("/dashboard")
    @Operation(summary = "风控大屏")
    public Result<Map<String, Object>> dashboard() {
        return Result.ok(riskReviewService.dashboard());
    }
}
