package com.cakeshop.service;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.config.CakeshopProperties;
import com.cakeshop.integration.WechatCloudClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * 历史消息/行为日志 可回溯查询服务
 *  - 直接调云函数 queryChatHistory / queryBehaviorLog
 *  - 走 adminBypass 模式
 */
@Slf4j
@Service
public class HistoryQueryService {

    @Autowired private WechatCloudClient cloudClient;
    @Autowired private CakeshopProperties properties;

    /**
     * 查询聊天历史
     *   { sessionId, type, from, startTs, endTs, page, size, keyword }
     */
    public Map<String, Object> queryChat(Map<String, Object> params) {
        Map<String, Object> req = new HashMap<>(params);
        req.put("adminBypass", true);
        req.putIfAbsent("page", 1);
        req.putIfAbsent("size", 50);
        return invoke("queryChatHistory", req);
    }

    /**
     * 查询行为日志
     */
    public Map<String, Object> queryBehavior(Map<String, Object> params) {
        Map<String, Object> req = new HashMap<>(params);
        req.put("adminBypass", true);
        req.putIfAbsent("page", 1);
        req.putIfAbsent("size", 50);
        return invoke("queryBehaviorLog", req);
    }

    /**
     * 按 session 汇总行为
     */
    public Map<String, Object> groupBySession(Map<String, Object> params) {
        Map<String, Object> req = new HashMap<>(params);
        req.put("adminBypass", true);
        req.put("groupBy", "session");
        return invoke("queryBehaviorLog", req);
    }

    /**
     * 导出历史
     *   { type: 'chat'|'behavior', startTs, endTs, ... }
     */
    public Map<String, Object> export(Map<String, Object> params) {
        Map<String, Object> req = new HashMap<>(params);
        req.put("adminBypass", true);
        return invoke("exportHistory", req);
    }

    private Map<String, Object> invoke(String fn, Map<String, Object> req) {
        long start = System.currentTimeMillis();
        try {
            Map<String, Object> r = cloudClient.invoke(fn, req);
            long cost = System.currentTimeMillis() - start;
            log.info("[{}] invoked, cost={}ms", fn, cost);
            return r;
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("[{}] invoke error", fn, e);
            throw new BizException(ErrorCode.EXTERNAL_API_ERROR, "历史查询失败: " + e.getMessage());
        }
    }
}
