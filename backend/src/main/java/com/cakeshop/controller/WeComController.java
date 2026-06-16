package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.integration.WechatCloudClient;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/wecom")
@Tag(name = "企业微信客服集成")
public class WeComController {

    @Autowired private WechatCloudClient cloudClient;

    @PostMapping("/config/get")
    @Operation(summary = "获取企业微信配置")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Map<String, Object>> getConfig() {
        return invoke("wecomConfig", Map.of("action", "get", "adminBypass", true));
    }

    @PostMapping("/config/save")
    @Operation(summary = "保存企业微信配置")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<Map<String, Object>> saveConfig(@RequestBody Map<String, Object> body) {
        Map<String, Object> req = new HashMap<>(body);
        req.put("action", "save");
        req.put("adminBypass", true);
        return invoke("wecomConfig", req);
    }

    @PostMapping("/kf/sync")
    @Operation(summary = "同步客服账号列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Map<String, Object>> syncKf() {
        return invoke("listWeComKf", Map.of("adminBypass", true));
    }

    @PostMapping("/callback/url")
    @Operation(summary = "获取回调 URL 校验参数")
    public Result<Map<String, Object>> callbackUrl() {
        // 给运维配置
        return Result.ok(Map.of(
            "url", "/wecom/callback",
            "note", "企业微信管理后台需配置此 URL 接收回调"
        ));
    }

    private Result<Map<String, Object>> invoke(String fn, Map<String, Object> req) {
        return Result.ok(cloudClient.invoke(fn, req));
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
