package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.entity.Coupon;
import com.cakeshop.service.CouponService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Coupon API
 * 路径前缀: /api/v1/coupon
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/coupon")
@Tag(name = "Coupon")
public class CouponController {

    @Autowired private CouponService service;

    @GetMapping("")
    @Operation(summary = "list")
    public Result<Object> list(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.list();
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("list fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @PostMapping("/receive")
    @Operation(summary = "receive")
    public Result<Object> receive(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.receive(lng(body.get("userId")), lng(body.get("couponId")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("receive fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @GetMapping("/mine")
    @Operation(summary = "mine")
    public Result<Object> mine(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.myCoupons(lng(body.get("userId")), integer(body.get("status")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("mine fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }


    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
