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
@RequestMapping("/wecom/agent")
@Api(tags = "企微客服台")
public class WeComAgentController {

    @Autowired private WechatCloudClient cloudClient;

    @PostMapping("/session/list")
    @ApiOperation("企微会话列表(客服台)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> sessionList(@RequestBody Map<String, Object> body) {
        Map<String, Object> req = new HashMap<>(body);
        req.put("adminBypass", true);
        return invoke("wecomSessionList", req);
    }

    @PostMapping("/session/history")
    @ApiOperation("企微会话聊天历史")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> history(@RequestBody Map<String, Object> body) {
        Map<String, Object> req = new HashMap<>(body);
        req.put("adminBypass", true);
        return invoke("wecomChatHistory", req);
    }

    @PostMapping("/send")
    @ApiOperation("客服主动发消息")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> send(@RequestBody Map<String, Object> body) {
        return invoke("wecomSendText", body);
    }

    @PostMapping("/session/close")
    @ApiOperation("客服主动挂断")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> close(@RequestBody Map<String, Object> body) {
        return invoke("wecomCloseSession", body);
    }

    @PostMapping("/client/hangup")
    @ApiOperation("客户主动挂断")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> clientHangup(@RequestBody Map<String, Object> body) {
        return invoke("clientHangup", body);
    }

    private Result<Map<String, Object>> invoke(String fn, Map<String, Object> body) {
        Map<String, Object> req = new HashMap<>(body);
        req.putIfAbsent("adminBypass", true);
        return invoke(fn, req);
    }
}
