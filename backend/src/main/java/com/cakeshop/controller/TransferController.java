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
@RequestMapping("/transfer")
@Tag(name = "客服转接")
public class TransferController {

    @Autowired private WechatCloudClient cloudClient;

    @PostMapping("/to-wecom")
    @Operation(summary = "发起转接(到企业微信)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> toWeCom(@RequestBody Map<String, Object> body) {
        return invoke("transferToWeCom", body);
    }

    @PostMapping("/log")
    @Operation(summary = "转接记录查询")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'READONLY')")
    public Result<Map<String, Object>> log(@RequestBody Map<String, Object> body) {
        return invoke("queryTransferLog", body);
    }

    private Result<Map<String, Object>> invoke(String fn, Map<String, Object> body) {
        Map<String, Object> req = new HashMap<>(body);
        req.put("adminBypass", true);
        return invoke(fn, req);
    }
}
