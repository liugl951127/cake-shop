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
 * 商家后台 - 客服管理
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/chat")
@Tag(name = "管理后台 - 客服")
public class AdminChatController {

    @GetMapping("/sessions")
    @Operation(summary = "会话列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> sessions(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String agentId,
        @RequestParam(required = false) String openid,
        @RequestParam(required = false) Long startTime,
        @RequestParam(required = false) Long endTime
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("page", page);
        data.put("size", size);
        data.put("total", 0);
        data.put("list", List.of());
        // TODO
        return Result.ok(data);
    }

    @GetMapping("/sessions/{sessionId}/messages")
    @Operation(summary = "会话历史")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> history(
        @PathVariable String sessionId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "50") int size
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("sessionId", sessionId);
        data.put("list", List.of());
        // TODO
        return Result.ok(data);
    }

    @PostMapping("/sessions/{sessionId}/messages")
    @Operation(summary = "客服主动发消息")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> send(@PathVariable String sessionId, @RequestBody Map<String, Object> body) {
        Map<String, Object> data = new HashMap<>();
        data.put("sessionId", sessionId);
        data.put("sent", true);
        // TODO: wsGateway adminSend
        return Result.ok(data);
    }

    @PostMapping("/sessions/{sessionId}/close")
    @Operation(summary = "关闭会话")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','CUSTOMER_SERVICE')")
    public Result<Void> close(@PathVariable String sessionId, @RequestBody(required = false) Map<String, Object> body) {
        return Result.ok();
    }

    @PostMapping("/sessions/{sessionId}/reopen")
    @Operation(summary = "重开会话")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public Result<Void> reopen(@PathVariable String sessionId) {
        return Result.ok();
    }

    @PostMapping("/users/{userId}/block")
    @Operation(summary = "拉黑用户")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public Result<Void> blockUser(@PathVariable String userId, @RequestBody(required = false) Map<String, Object> body) {
        return Result.ok();
    }

    @PostMapping("/users/{userId}/unblock")
    @Operation(summary = "解除拉黑")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public Result<Void> unblockUser(@PathVariable String userId) {
        return Result.ok();
    }

    @PostMapping("/sessions/{sessionId}/transfer")
    @Operation(summary = "转接会话")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> transfer(@PathVariable String sessionId, @RequestBody Map<String, Object> body) {
        if (body.get("toAgentId") == null) throw new BizException(ErrorCode.BAD_REQUEST, "toAgentId 必填");
        Map<String, Object> data = new HashMap<>();
        data.put("sessionId", sessionId);
        data.put("transferred", body.get("toAgentId"));
        return Result.ok(data);
    }

    @GetMapping("/agents")
    @Operation(summary = "客服列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> agents() {
        Map<String, Object> data = new HashMap<>();
        data.put("list", List.of());
        return Result.ok(data);
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
