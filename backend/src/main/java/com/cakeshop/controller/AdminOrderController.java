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
 * 商家后台 - 订单管理
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/orders")
@Tag(name = "管理后台 - 订单")
public class AdminOrderController {

    @GetMapping("/list")
    @Operation(summary = "订单列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR','CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Integer status,
        @RequestParam(required = false) Integer payStatus,
        @RequestParam(required = false) Long startTime,
        @RequestParam(required = false) Long endTime
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("page", page);
        data.put("size", size);
        data.put("total", 0);
        data.put("list", List.of());
        data.put("summary", Map.of("sumTotal", 0, "sumPaid", 0));
        // TODO: OrderService
        return Result.ok(data);
    }

    @PostMapping("/{id}/ship")
    @Operation(summary = "发货")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    public Result<Void> ship(@PathVariable String id, @RequestBody Map<String, Object> body) {
        if (body.get("name") == null || body.get("phone") == null) {
            throw new BizException(ErrorCode.BAD_REQUEST, "name/phone 必填");
        }
        // TODO: OrderService.ship
        return Result.ok();
    }

    @PostMapping("/{id}/refund")
    @Operation(summary = "退款")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public Result<Map<String, Object>> refund(@PathVariable String id, @RequestBody Map<String, Object> body) {
        String action = (String) body.getOrDefault("action", "approve");
        if (!List.of("approve", "reject", "force").contains(action)) {
            throw new BizException(ErrorCode.BAD_REQUEST, "action 必填");
        }
        Map<String, Object> data = new HashMap<>();
        data.put("refunded", body.get("amount"));
        // TODO
        return Result.ok(data);
    }

    @PutMapping("/{id}/address")
    @Operation(summary = "修改地址")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    public Result<Void> updateAddress(@PathVariable String id, @RequestBody Map<String, Object> body) {
        // TODO
        return Result.ok();
    }

    @PostMapping("/{id}/print")
    @Operation(summary = "打印小票")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    public Result<Map<String, Object>> print(@PathVariable String id) {
        Map<String, Object> data = new HashMap<>();
        data.put("printed", id);
        data.put("printUrl", "/api/v1/print/order/" + id);
        // TODO: 调小票打印服务
        return Result.ok(data);
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
