package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.entity.Cart;
import com.cakeshop.service.CartService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/cart")
@Tag(name = "Cart")
public class CartController {

    @Autowired private CartService service;

    @GetMapping("")
    @Operation(summary = "列出购物车")
    public Result<Object> list(@RequestBody Map<String, Object> body) {
        try {
            return Result.ok(service.listByUser(lng(body.get("userId"))));
        } catch (Exception e) {
            log.warn("list fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @PostMapping("")
    @Operation(summary = "加入购物车")
    public Result<Object> add(@RequestBody Map<String, Object> body) {
        try {
            return Result.ok(service.add(lng(body.get("userId")), lng(body.get("goodsId")),
                str(body.get("spec")), integer(body.get("count"))));
        } catch (Exception e) {
            log.warn("add fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @PutMapping("/{id}/count")
    @Operation(summary = "修改数量")
    public Result<Void> setCount(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            service.setCount(id, integer(body.get("count")));
            return Result.ok();
        } catch (Exception e) {
            log.warn("setCount fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除")
    public Result<Void> remove(@PathVariable Long id) {
        try {
            service.removeById(id);
            return Result.ok();
        } catch (Exception e) {
            log.warn("remove fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @DeleteMapping("/selected")
    @Operation(summary = "清空已选")
    public Result<Void> clear(@RequestBody Map<String, Object> body) {
        try {
            service.clearSelected(lng(body.get("userId")));
            return Result.ok();
        } catch (Exception e) {
            log.warn("clear fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }
}
