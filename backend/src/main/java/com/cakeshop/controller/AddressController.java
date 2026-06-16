package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.entity.Address;
import com.cakeshop.service.AddressService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/address")
@Tag(name = "Address")
public class AddressController {

    @Autowired private AddressService service;

    @GetMapping("")
    @Operation(summary = "地址列表")
    public Result<Object> list(@RequestBody Map<String, Object> body) {
        try {
            return Result.ok(service.listByUser(lng(body.get("userId"))));
        } catch (Exception e) {
            log.warn("list fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @PostMapping("")
    @Operation(summary = "新增地址")
    public Result<Address> add(@RequestBody Address a) {
        try {
            return Result.ok(service.add(a));
        } catch (Exception e) {
            log.warn("add fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @PutMapping("")
    @Operation(summary = "更新地址")
    public Result<Void> update(@RequestBody Address a) {
        try {
            service.update(a);
            return Result.ok();
        } catch (Exception e) {
            log.warn("update fail: " + e.getMessage());
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

    @PutMapping("/{id}/default")
    @Operation(summary = "设为默认")
    public Result<Void> setDefault(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            service.setDefault(lng(body.get("userId")), id);
            return Result.ok();
        } catch (Exception e) {
            log.warn("setDefault fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
}
