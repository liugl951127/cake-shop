package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.entity.Member;
import com.cakeshop.repository.MemberRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 会员服务
 */
@Slf4j
@Service
public class MemberService extends ServiceImpl<MemberRepository, Member> {

    public Member getByUserId(Long userId) {
        if (userId == null) return null;
        return lambdaQuery().eq(Member::getUserId, userId).one();
    }

    public Member getByOpenid(String openid) {
        if (openid == null) return null;
        return lambdaQuery().eq(Member::getOpenid, openid).one();
    }

    public Member getOrCreate(String openid, String nickname, String avatar) {
        Member m = getByOpenid(openid);
        if (m == null) {
            m = new Member();
            m.setUserId(Math.abs((openid + System.currentTimeMillis()).hashCode()) + 10000L);
            m.setOpenid(openid);
            m.setNickname(nickname != null ? nickname : "用户" + (int) (Math.random() * 10000));
            m.setAvatar(avatar != null ? avatar : "");
            m.setLevel("basic");
            m.setGrowth(0);
            m.setBalance(BigDecimal.ZERO);
            m.setFrozen(BigDecimal.ZERO);
            m.setPoints(0);
            m.setTotalSpend(BigDecimal.ZERO);
            m.setDiscount(new BigDecimal("1.00"));
            m.setIsAdmin(0);
            m.setStatus(1);
            m.setRegisterTime(LocalDateTime.now());
            m.setLastLoginTime(LocalDateTime.now());
            save(m);
        } else {
            m.setLastLoginTime(LocalDateTime.now());
            updateById(m);
        }
        return m;
    }

    public void addGrowth(Long userId, int growth, BigDecimal amount) {
        if (userId == null) return;
        Member m = getByUserId(userId);
        if (m == null) return;
        m.setGrowth((m.getGrowth() == null ? 0 : m.getGrowth()) + growth);
        if (amount != null) m.setTotalSpend((m.getTotalSpend() == null ? BigDecimal.ZERO : m.getTotalSpend()).add(amount));
        // 等级: 0/500/2000/5000
        int g = m.getGrowth();
        if (g >= 5000) { m.setLevel("diamond"); m.setDiscount(new BigDecimal("0.85")); }
        else if (g >= 2000) { m.setLevel("gold"); m.setDiscount(new BigDecimal("0.90")); }
        else if (g >= 500) { m.setLevel("silver"); m.setDiscount(new BigDecimal("0.95")); }
        else { m.setLevel("basic"); m.setDiscount(new BigDecimal("1.00")); }
        updateById(m);
    }

    public void addPoints(Long userId, int points) {
        if (userId == null || points == 0) return;
        Member m = getByUserId(userId);
        if (m == null) return;
        m.setPoints((m.getPoints() == null ? 0 : m.getPoints()) + points);
        updateById(m);
    }

    public Map<String, Object> getLevelConfig() {
        Map<String, Object> data = new HashMap<>();
        data.put("basic", Map.of("name", "普通会员", "discount", 1.0, "minGrowth", 0));
        data.put("silver", Map.of("name", "银卡会员", "discount", 0.95, "minGrowth", 500));
        data.put("gold", Map.of("name", "金卡会员", "discount", 0.90, "minGrowth", 2000));
        data.put("diamond", Map.of("name", "钻石会员", "discount", 0.85, "minGrowth", 5000));
        return data;
    }
}
