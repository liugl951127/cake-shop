package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.entity.CmsPage;
import com.cakeshop.service.CmsService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Cms API
 * 路径前缀: /api/v1/cms
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/cms")
@Tag(name = "Cms")
public class CmsController {

    @Autowired private CmsService service;

    @GetMapping("/{key}")
    @Operation(summary = "get")
    public Result<Object> get(@PathVariable String key) {
        try {
            return Result.ok(service.getByKey(key));
        } catch (Exception e) {
            log.warn("get fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }


    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
