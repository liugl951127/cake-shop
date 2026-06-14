package com.cakeshop.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import com.cakeshop.entity.Order;
import com.cakeshop.service.OrderService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/orders")
@Tag(name = "订单管理")
public class OrderController {

    @Autowired private OrderService orderService;

    @GetMapping
    @Operation(summary = "订单列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'CUSTOMER_SERVICE')")
    public Result<IPage<Order>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) Integer status,
        @RequestParam(required = false) Long userId
    ) {
        return Result.ok(orderService.pageOrders(page, size, status, userId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "订单详情")
    public Result<Order> detail(@PathVariable Long id) {
        Order o = orderService.getById(id);
        if (o == null) return Result.fail(ErrorCode.NOT_FOUND.getCode(), "订单不存在");
        return Result.ok(o);
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "取消订单")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR') or @orderOwnerCheck.check(#id)")
    public Result<Void> cancel(@PathVariable Long id) {
        orderService.cancel(id);
        return Result.ok();
    }

    @PostMapping("/{id}/ship")
    @Operation(summary = "发货")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Void> ship(@PathVariable Long id, @RequestBody Map<String, String> body) {
        orderService.ship(id, body.getOrDefault("logistics", ""));
        return Result.ok();
    }

    @PostMapping("/{id}/refund/approve")
    @Operation(summary = "审批退款")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'FINANCE')")
    public Result<Void> approveRefund(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        boolean approve = Boolean.TRUE.equals(body.get("approve"));
        String note = (String) body.getOrDefault("note", "");
        orderService.approveRefund(id, approve, note);
        return Result.ok();
    }

    @GetMapping("/dashboard")
    @Operation(summary = "订单看板")
    public Result<Map<String, Object>> dashboard() {
        return Result.ok(orderService.dashboard());
    }
}
