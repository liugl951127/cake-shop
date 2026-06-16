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
 * 商家后台 - 营销活动管理
 *   涵盖: 券 / 秒杀 / 拼团 / 满减 / 福袋
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/marketing")
@Tag(name = "管理后台 - 营销")
public class AdminMarketingController {

    private static final List<String> TYPES = List.of("coupon", "seckill", "group", "fullReduce", "luckyBag");

    @GetMapping("/{type}/list")
    @Operation(summary = "活动列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    public Result<Map<String, Object>> list(
        @PathVariable String type,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Integer status
    ) {
        if (!TYPES.contains(type)) throw new BizException(ErrorCode.BAD_REQUEST, "type 错误");
        Map<String, Object> data = new HashMap<>();
        data.put("type", type);
        data.put("page", page);
        data.put("size", size);
        data.put("total", 0);
        data.put("list", List.of());
        // TODO
        return Result.ok(data);
    }

    @PostMapping("/{type}")
    @Operation(summary = "创建活动")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public Result<Map<String, Object>> create(@PathVariable String type, @RequestBody Map<String, Object> body) {
        if (!TYPES.contains(type)) throw new BizException(ErrorCode.BAD_REQUEST, "type 错误");
        Map<String, Object> data = new HashMap<>();
        data.put("id", "new-" + System.currentTimeMillis());
        data.put("type", type);
        // TODO
        return Result.ok(data);
    }

    @PutMapping("/{type}/{id}")
    @Operation(summary = "更新活动")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public Result<Void> update(@PathVariable String type, @PathVariable String id, @RequestBody Map<String, Object> body) {
        if (!TYPES.contains(type)) throw new BizException(ErrorCode.BAD_REQUEST, "type 错误");
        return Result.ok();
    }

    @DeleteMapping("/{type}/{id}")
    @Operation(summary = "删除活动")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public Result<Void> delete(@PathVariable String type, @PathVariable String id) {
        return Result.ok();
    }

    @PostMapping("/{type}/{id}/toggle")
    @Operation(summary = "上下架活动")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    public Result<Map<String, Object>> toggle(@PathVariable String type, @PathVariable String id) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", id);
        data.put("status", 1);
        // TODO
        return Result.ok(data);
    }
}
