package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.service.ConfigCenterService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api-config")
@Api(tags = "接口配置中心")
public class ApiConfigController {

    @Autowired private ConfigCenterService configService;

    @PostMapping("/get")
    @ApiOperation("获取接口配置(按分组)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Map<String, Object>> get(@RequestBody Map<String, String> body) {
        String group = body == null ? null : body.get("group");
        return Result.ok(configService.getApiConfig(group));
    }

    @PostMapping("/save")
    @ApiOperation("保存接口配置")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Void> save(@RequestBody Map<String, Object> body) {
        configService.saveApiConfig(body);
        return Result.ok();
    }

    @PostMapping("/test")
    @ApiOperation("测试接口连通性")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Map<String, Object>> test(@RequestBody Map<String, String> body) {
        return Result.ok(configService.testApi(
            body.get("provider"),
            body.get("apiKey"),
            body.get("baseUrl")
        ));
    }
}
