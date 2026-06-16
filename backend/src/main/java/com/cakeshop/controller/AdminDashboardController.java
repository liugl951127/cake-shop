package com.cakeshop.controller;

import com.cakeshop.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 商家后台聚合仪表盘(本地版)
 *   - 后台 admin-h5 调 Spring Boot 而非云函数时使用
 *   - 真实数据从 DB 查
 *   - 这里提供基础版 + 端点,生产接 MyBatis-Plus
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/dashboard")
@Tag(name = "管理后台 - 仪表盘", description = "聚合概览/趋势/分布")
public class AdminDashboardController {

    @GetMapping("/overview")
    @Operation(summary = "后台概览 - 关键指标")
    public Result<Map<String, Object>> overview() {
        Map<String, Object> data = new HashMap<>();
        // TODO: 接 OrderService / MemberService / GoodsService 真实数据
        data.put("todayRevenue", 0);
        data.put("todayOrderCount", 0);
        data.put("todayNewMembers", 0);
        data.put("totalGoods", 0);
        data.put("totalMembers", 0);
        data.put("pendingOrders", 0);
        data.put("pendingTickets", 0);
        data.put("onlineAgents", 0);
        data.put("auditToday", 0);
        data.put("errorToday", 0);
        data.put("generatedAt", System.currentTimeMillis());
        return Result.ok(data);
    }

    @GetMapping("/trend7d")
    @Operation(summary = "7 天趋势")
    public Result<Map<String, Object>> trend7d() {
        Map<String, Object> data = new HashMap<>();
        // TODO: 真实查 orders 表
        Map<String, Object> trend = new HashMap<>();
        for (int i = 6; i >= 0; i--) {
            String d = java.time.LocalDate.now().minusDays(i).toString();
            trend.put(d, Map.of("count", 0, "amount", 0));
        }
        data.put("trend", trend);
        return Result.ok(data);
    }

    @GetMapping("/category-distribution")
    @Operation(summary = "商品分类分布")
    public Result<Map<String, Object>> categoryDistribution() {
        Map<String, Object> data = new HashMap<>();
        data.put("distribution", new HashMap<>());
        return Result.ok(data);
    }
}
