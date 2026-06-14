package com.cakeshop.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.entity.RiskLog;
import com.cakeshop.repository.RiskLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 风控审核 Service
 *   - 待审列表
 *   - 审批通过/拒绝
 *   - 大盘统计
 */
@Slf4j
@Service
public class RiskReviewService extends ServiceImpl<RiskLogRepository, RiskLog> {

    public Page<RiskLog> pending(Page<RiskLog> page) {
        return page(page, new LambdaQueryWrapper<RiskLog>()
            .eq(RiskLog::getReviewStatus, "pending")
            .orderByAsc(RiskLog::getCreateTime));
    }

    public void approve(Long logId, String note) {
        updateStatus(logId, "approved", note);
    }

    public void reject(Long logId, String note) {
        RiskLog l = getById(logId);
        if (l == null) throw new BizException(ErrorCode.NOT_FOUND, "记录不存在");
        updateStatus(logId, "rejected", note);
        // 联动:如果有关联订单,标 -3
        // (实际应该调云函数 / 写订单库)
    }

    private void updateStatus(Long logId, String status, String note) {
        RiskLog l = getById(logId);
        if (l == null) throw new BizException(ErrorCode.NOT_FOUND, "记录不存在");
        l.setReviewStatus(status);
        l.setReviewNote(note);
        l.setReviewTime(LocalDateTime.now());
        updateById(l);
        log.info("风控审核: logId={}, status={}, note={}", logId, status, note);
    }

    public Map<String, Object> dashboard() {
        // 今日: 总检查/各决策
        // 简化:全表统计
        Map<String, Object> res = new HashMap<>();
        long total = count();
        res.put("total", total);
        res.put("pass", count(new LambdaQueryWrapper<RiskLog>().eq(RiskLog::getDecision, "pass")));
        res.put("verify", count(new LambdaQueryWrapper<RiskLog>().eq(RiskLog::getDecision, "verify")));
        res.put("manual", count(new LambdaQueryWrapper<RiskLog>().eq(RiskLog::getDecision, "manual")));
        res.put("reject", count(new LambdaQueryWrapper<RiskLog>().eq(RiskLog::getDecision, "reject")));
        return res;
    }
}
