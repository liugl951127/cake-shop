package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.entity.Member;
import com.cakeshop.entity.WalletLog;
import com.cakeshop.repository.WalletLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class WalletService extends ServiceImpl<WalletLogRepository, WalletLog> {

    @Autowired private MemberService memberService;

    @Transactional(rollbackFor = Exception.class)
    public WalletLog recharge(Long userId, BigDecimal amount, String remark) {
        if (userId == null) throw new BizException(ErrorCode.BAD_REQUEST, "userId 必填");
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BizException(ErrorCode.AMOUNT_INVALID, "金额无效");
        }
        Member m = memberService.getByUserId(userId);
        if (m == null) throw new BizException(ErrorCode.NOT_FOUND, "用户不存在");
        BigDecimal before = m.getBalance() == null ? BigDecimal.ZERO : m.getBalance();
        m.setBalance(before.add(amount));
        memberService.updateById(m);
        return writeLog(userId, "recharge", amount, before, m.getBalance(), "", remark);
    }

    @Transactional(rollbackFor = Exception.class)
    public WalletLog pay(Long userId, BigDecimal amount, Long orderId) {
        if (userId == null || amount == null || orderId == null) {
            throw new BizException(ErrorCode.BAD_REQUEST, "参数错误");
        }
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BizException(ErrorCode.AMOUNT_INVALID, "金额无效");
        }
        Member m = memberService.getByUserId(userId);
        if (m == null) throw new BizException(ErrorCode.NOT_FOUND, "用户不存在");
        BigDecimal before = m.getBalance() == null ? BigDecimal.ZERO : m.getBalance();
        if (before.compareTo(amount) < 0) {
            throw new BizException(ErrorCode.AMOUNT_INVALID, "余额不足");
        }
        m.setBalance(before.subtract(amount));
        memberService.updateById(m);
        return writeLog(userId, "pay", amount.negate(), before, m.getBalance(),
            String.valueOf(orderId), "订单支付");
    }

    @Transactional(rollbackFor = Exception.class)
    public WalletLog refund(Long userId, BigDecimal amount, Long orderId, String remark) {
        if (userId == null || amount == null) {
            throw new BizException(ErrorCode.BAD_REQUEST, "参数错误");
        }
        Member m = memberService.getByUserId(userId);
        if (m == null) throw new BizException(ErrorCode.NOT_FOUND, "用户不存在");
        BigDecimal before = m.getBalance() == null ? BigDecimal.ZERO : m.getBalance();
        m.setBalance(before.add(amount));
        memberService.updateById(m);
        return writeLog(userId, "refund", amount, before, m.getBalance(),
            String.valueOf(orderId), remark != null ? remark : "退款");
    }

    public List<WalletLog> listByUser(Long userId, Integer page, Integer size) {
        if (page == null || page < 1) page = 1;
        if (size == null || size < 1) size = 20;
        return lambdaQuery().eq(WalletLog::getUserId, userId)
            .orderByDesc(WalletLog::getCreateTime)
            .last("LIMIT " + (page - 1) * size + "," + size).list();
    }

    private WalletLog writeLog(Long userId, String type, BigDecimal amount,
                                BigDecimal before, BigDecimal after,
                                String refId, String remark) {
        WalletLog log = new WalletLog();
        log.setUserId(userId);
        log.setType(type);
        log.setAmount(amount);
        log.setBalanceBefore(before);
        log.setBalanceAfter(after);
        log.setRefId(refId != null ? refId : "");
        log.setRemark(remark != null ? remark : "");
        log.setCreateTime(LocalDateTime.now());
        save(log);
        return log;
    }
}
