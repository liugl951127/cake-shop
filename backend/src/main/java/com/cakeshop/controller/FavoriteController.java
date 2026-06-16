package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.entity.Favorite;
import com.cakeshop.service.FavoriteService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Favorite API
 * 路径前缀: /api/v1/favorite
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/favorite")
@Tag(name = "Favorite")
public class FavoriteController {

    @Autowired private FavoriteService service;

    @GetMapping("")
    @Operation(summary = "list")
    public Result<Object> list(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.listByUser(lng(body.get("userId")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("list fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @PostMapping("/toggle")
    @Operation(summary = "toggle")
    public Result<Object> toggle(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.toggle(lng(body.get("userId")), lng(body.get("goodsId")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("toggle fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }


    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
