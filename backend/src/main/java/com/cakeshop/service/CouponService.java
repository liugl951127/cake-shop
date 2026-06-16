package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.entity.Coupon;
import com.cakeshop.entity.MemberCoupon;
import com.cakeshop.repository.CouponRepository;
import com.cakeshop.repository.MemberCouponRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class CouponService extends ServiceImpl<CouponRepository, Coupon> {

    @Autowired private MemberCouponRepository memberCouponRepository;

    public List<Coupon> listActive() {
        LocalDateTime now = LocalDateTime.now();
        return lambdaQuery().eq(Coupon::getStatus, 1)
            .le(Coupon::getStartTime, now).ge(Coupon::getEndTime, now)
            .gt(Coupon::getRemain, 0)
            .orderByDesc(Coupon::getCreateTime).list();
    }

    @Transactional(rollbackFor = Exception.class)
    public MemberCoupon receive(Long userId, Long couponId) {
        if (userId == null || couponId == null) {
            throw new BizException(ErrorCode.BAD_REQUEST, "参数错误");
        }
        Coupon c = getById(couponId);
        if (c == null || c.getStatus() != 1) {
            throw new BizException(ErrorCode.NOT_FOUND, "优惠券不存在");
        }
        LocalDateTime now = LocalDateTime.now();
        if (c.getStartTime().isAfter(now) || c.getEndTime().isBefore(now)) {
            throw new BizException(ErrorCode.EXPIRED, "不在活动期内");
        }
        if (c.getRemain() == null || c.getRemain() <= 0) {
            throw new BizException(ErrorCode.USED, "已领完");
        }
        long already = memberCouponRepository.selectCount(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<MemberCoupon>()
            .eq("member_id", userId).eq("coupon_id", couponId));
        if (already >= c.getPerLimit()) {
            throw new BizException(ErrorCode.FAIL, "已达限领数量");
        }
        c.setRemain(c.getRemain() - 1);
        updateById(c);
        MemberCoupon mc = new MemberCoupon();
        mc.setMemberId(userId);
        mc.setCouponId(couponId);
        mc.setStatus(0);
        mc.setReceiveTime(now);
        mc.setExpireTime(c.getEndTime());
        memberCouponRepository.insert(mc);
        return mc;
    }

    public List<MemberCoupon> myCoupons(Long userId, Integer status) {
        if (userId == null) return List.of();
        // 自动过期
        memberCouponRepository.update(new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<MemberCoupon>()
            .eq("member_id", userId).eq("status", 0).lt("expire_time", LocalDateTime.now())
            .set("status", 2));
        return memberCouponRepository.selectList(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<MemberCoupon>()
            .eq("member_id", userId)
            .eq(status != null, "status", status)
            .orderByDesc("receive_time"));
    }

    @Transactional(rollbackFor = Exception.class)
    public void useCoupon(Long userId, Long couponId, Long orderId) {
        MemberCoupon mc = memberCouponRepository.selectOne(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<MemberCoupon>()
            .eq("member_id", userId).eq("coupon_id", couponId).eq("status", 0));
        if (mc == null) throw new BizException(ErrorCode.NOT_FOUND, "无可用优惠券");
        mc.setStatus(1);
        mc.setUsedTime(LocalDateTime.now());
        mc.setUsedOrderId(orderId);
        memberCouponRepository.updateById(mc);
    }
}
