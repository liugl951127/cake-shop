package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.service.ConfigCenterService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api-config")
@Tag(name = "接口配置中心")
public class ApiConfigController {

    @Autowired private ConfigCenterService configService;

    @PostMapping("/get")
    @Operation(summary = "获取接口配置(按分组)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Map<String, Object>> get(@RequestBody Map<String, String> body) {
        String group = body == null ? null : body.get("group");
        return Result.ok(configService.getApiConfig(group));
    }

    @PostMapping("/save")
    @Operation(summary = "保存接口配置")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Void> save(@RequestBody Map<String, Object> body) {
        configService.saveApiConfig(body);
        return Result.ok();
    }

    @PostMapping("/test")
    @Operation(summary = "测试接口连通性")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Map<String, Object>> test(@RequestBody Map<String, String> body) {
        return Result.ok(configService.testApi(
            body.get("provider"),
            body.get("apiKey"),
            body.get("baseUrl")
        ));
    }
}
