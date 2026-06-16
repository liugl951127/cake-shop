package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.service.HistoryQueryService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/history")
@Tag(name = "历史回溯")
public class HistoryController {

    @Autowired private HistoryQueryService historyService;

    @PostMapping("/chat")
    @Operation(summary = "查询聊天历史(可按时间/类型/关键字)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE')")
    public Result<Map<String, Object>> queryChat(@RequestBody Map<String, Object> body) {
        return Result.ok(historyService.queryChat(body));
    }

    @PostMapping("/behavior")
    @Operation(summary = "查询行为日志(可按用户/事件/页面)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'READONLY')")
    public Result<Map<String, Object>> queryBehavior(@RequestBody Map<String, Object> body) {
        return Result.ok(historyService.queryBehavior(body));
    }

    @PostMapping("/behavior/groupBySession")
    @Operation(summary = "按会话汇总行为")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'READONLY')")
    public Result<Map<String, Object>> groupBySession(@RequestBody Map<String, Object> body) {
        return Result.ok(historyService.groupBySession(body));
    }

    @PostMapping("/export")
    @Operation(summary = "导出历史(批量,超 5000 自动分段)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'FINANCE')")
    public Result<Map<String, Object>> export(@RequestBody Map<String, Object> body) {
        return Result.ok(historyService.export(body));
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
