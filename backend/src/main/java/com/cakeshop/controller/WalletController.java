package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.entity.Member;
import com.cakeshop.service.WalletService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Wallet API
 * 路径前缀: /api/v1/wallet
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/wallet")
@Tag(name = "Wallet")
public class WalletController {

    @Autowired private WalletService service;

    @PostMapping("/recharge")
    @Operation(summary = "recharge")
    public Result<Object> recharge(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.recharge(lng(body.get("userId")), new java.math.BigDecimal(str(body.get("amount"))), str(body.get("remark")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("recharge fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @PostMapping("/pay")
    @Operation(summary = "pay")
    public Result<Object> pay(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.pay(lng(body.get("userId")), new java.math.BigDecimal(str(body.get("amount"))), lng(body.get("orderId")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("pay fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @GetMapping("/log")
    @Operation(summary = "log")
    public Result<Object> log(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.listByUser(lng(body.get("userId")), integer(body.get("page")), integer(body.get("size")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("log fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }


    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
