package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.entity.ChatSession;
import com.cakeshop.service.ChatService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Chat API
 * 路径前缀: /api/v1/chat
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/chat")
@Tag(name = "Chat")
public class ChatController {

    @Autowired private ChatService service;

    @PostMapping("/session")
    @Operation(summary = "getOrCreate")
    public Result<Object> getOrCreate(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.getOrCreateSession(lng(body.get("userId")), str(body.get("type")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("getOrCreate fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @PostMapping("/message")
    @Operation(summary = "send")
    public Result<Object> send(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.sendMessage(lng(body.get("sessionId")), str(body.get("from")), str(body.get("type")), str(body.get("content")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("send fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @GetMapping("/message/{sessionId}")
    @Operation(summary = "listMsg")
    public Result<Object> listMsg(@RequestBody Map<String, Object> body) {
        try {
            Object r = service.getMessages(lng(body.get("sessionId")), integer(body.get("page")), integer(body.get("size")));
            return Result.ok(r);
        } catch (Exception e) {
            log.warn("listMsg fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }

    @PostMapping("/close/{sessionId}")
    @Operation(summary = "close")
    public Result<Void> close(@PathVariable Long sessionId) {
        try {
            service.closeSession(sessionId);
            return Result.ok();
        } catch (Exception e) {
            log.warn("close fail: " + e.getMessage());
            return Result.fail(500, e.getMessage());
        }
    }


    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
