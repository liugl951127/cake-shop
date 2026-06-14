package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.integration.WechatCloudClient;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/wecom")
@Api(tags = "企业微信客服集成")
public class WeComController {

    @Autowired private WechatCloudClient cloudClient;

    @PostMapping("/config/get")
    @ApiOperation("获取企业微信配置")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Map<String, Object>> getConfig() {
        return invoke("wecomConfig", Map.of("action", "get", "adminBypass", true));
    }

    @PostMapping("/config/save")
    @ApiOperation("保存企业微信配置")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<Void> saveConfig(@RequestBody Map<String, Object> body) {
        Map<String, Object> req = new HashMap<>(body);
        req.put("action", "save");
        req.put("adminBypass", true);
        return invoke("wecomConfig", req);
    }

    @PostMapping("/kf/sync")
    @ApiOperation("同步客服账号列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Map<String, Object>> syncKf() {
        return invoke("listWeComKf", Map.of("adminBypass", true));
    }

    @PostMapping("/callback/url")
    @ApiOperation("获取回调 URL 校验参数")
    public Result<Map<String, Object>> callbackUrl() {
        // 给运维配置
        return Result.ok(Map.of(
            "url", "/wecom/callback",
            "note", "企业微信管理后台需配置此 URL 接收回调"
        ));
    }
}
