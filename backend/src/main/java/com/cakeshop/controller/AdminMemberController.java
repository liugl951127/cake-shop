package com.cakeshop.controller;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 商家后台 - 会员管理
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/members")
@Tag(name = "管理后台 - 会员")
public class AdminMemberController {

    @GetMapping("/list")
    @Operation(summary = "会员列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    public Result<Map<String, Object>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Integer level,
        @RequestParam(required = false) Long startTime,
        @RequestParam(required = false) Long endTime
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("page", page);
        data.put("size", size);
        data.put("total", 0);
        data.put("list", List.of());
        // TODO: MemberService
        return Result.ok(data);
    }

    @PostMapping("/{userId}/adjust")
    @Operation(summary = "会员调整: 积分/等级/余额/状态")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public Result<Map<String, Object>> adjust(@PathVariable String userId, @RequestBody Map<String, Object> body) {
        String action = (String) body.get("action");
        if (!List.of("addPoints", "subPoints", "setLevel", "freeze", "unfreeze", "setBalance")
                .contains(action)) {
            throw new BizException(ErrorCode.BAD_REQUEST, "action 必填");
        }
        Map<String, Object> data = new HashMap<>();
        data.put("userId", userId);
        data.put("action", action);
        // TODO
        return Result.ok(data);
    }

    @GetMapping("/{userId}/detail")
    @Operation(summary = "会员详情")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    public Result<Map<String, Object>> detail(@PathVariable String userId) {
        Map<String, Object> data = new HashMap<>();
        data.put("userId", userId);
        // TODO
        return Result.ok(data);
    }
}
