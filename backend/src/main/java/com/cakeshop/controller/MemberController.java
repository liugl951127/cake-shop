package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.entity.Member;
import com.cakeshop.service.MemberService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/member")
@Tag(name = "Member")
public class MemberController {

    @Autowired private MemberService service;

    @GetMapping("")
    @Operation(summary = "会员信息")
    public Result<Member> get(@RequestBody Map<String, Object> body) {
        try {
            return Result.ok(service.getByUserId(lng(body.get("userId"))));
        } catch (Exception e) {
            return Result.fail(500, e.getMessage());
        }
    }

    @PostMapping("/login")
    @Operation(summary = "登录(自动注册)")
    public Result<Member> login(@RequestBody Map<String, Object> body) {
        try {
            return Result.ok(service.getOrCreate(
                str(body.get("openid")),
                str(body.get("nickname")),
                str(body.get("avatar"))));
        } catch (Exception e) {
            return Result.fail(500, e.getMessage());
        }
    }

    @PostMapping("/growth")
    @Operation(summary = "增加成长值")
    public Result<Void> addGrowth(@RequestBody Map<String, Object> body) {
        try {
            service.addGrowth(lng(body.get("userId")), integer(body.get("growth")),
                new java.math.BigDecimal(str(body.getOrDefault("amount", "0"))));
            return Result.ok();
        } catch (Exception e) {
            return Result.fail(500, e.getMessage());
        }
    }

    @GetMapping("/level")
    @Operation(summary = "等级配置")
    public Result<Object> level() {
        return Result.ok(service.getLevelConfig());
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }
}
