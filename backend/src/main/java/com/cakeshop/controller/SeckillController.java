package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.entity.Seckill;
import com.cakeshop.service.SeckillService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Seckill API
 * 路径前缀: /api/v1/seckill
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/seckill")
@Tag(name = "Seckill")
public class SeckillController {

    @Autowired private SeckillService service;

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

    @GetMapping("/{id}")
    @Operation(summary = "get")
    public Result<Object> get(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.get(lng(body.get("id")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("get fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }


    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
