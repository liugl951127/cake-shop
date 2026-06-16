package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.entity.LotteryRecord;
import com.cakeshop.service.LotteryService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Lottery API
 * 路径前缀: /api/v1/lottery
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/lottery")
@Tag(name = "Lottery")
public class LotteryController {

    @Autowired private LotteryService service;

    @PostMapping("/draw")
    @Operation(summary = "draw")
    public Result<Object> draw(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.draw(lng(body.get("userId")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("draw fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }


    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
