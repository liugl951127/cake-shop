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
@RequestMapping("/chat/config")
@Tag(name = "聊天动态配置")
public class ConfigCenterController {

    @Autowired private ConfigCenterService configService;

    @PostMapping("/get")
    @Operation(summary = "获取聊天配置")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> get() {
        return Result.ok(configService.getChatConfig());
    }

    @PostMapping("/save")
    @Operation(summary = "保存聊天配置")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Void> save(@RequestBody Map<String, Object> body) {
        configService.saveChatConfig(body);
        return Result.ok();
    }

    @PostMapping("/publish")
    @Operation(summary = "发布聊天配置(推送到云函数)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Void> publish() {
        configService.publishChatConfig();
        return Result.ok();
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
