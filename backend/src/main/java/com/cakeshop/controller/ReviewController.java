package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.entity.Review;
import com.cakeshop.service.ReviewService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/review")
@Tag(name = "Review")
public class ReviewController {

    @Autowired private ReviewService service;

    @PostMapping("")
    @Operation(summary = "提交评价")
    public Result<Review> add(@RequestBody Review review) {
        try {
            return Result.ok(service.add(review));
        } catch (Exception e) {
            log.warn("add fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @GetMapping("/goods/{goodsId}")
    @Operation(summary = "商品评价列表")
    public Result<Object> listByGoods(@PathVariable Long goodsId,
                                       @RequestParam(defaultValue = "1") Integer page,
                                       @RequestParam(defaultValue = "10") Integer size) {
        try {
            return Result.ok(service.listByGoods(goodsId, page, size));
        } catch (Exception e) {
            log.warn("listByGoods fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @PostMapping("/{id}/reply")
    @Operation(summary = "商家回复")
    public Result<Void> reply(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            service.reply(id, str(body.get("reply")));
            return Result.ok();
        } catch (Exception e) {
            log.warn("reply fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
}
