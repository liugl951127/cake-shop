package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 用户领取的优惠券
 * 对应表 member_coupon
 */
@Data
@TableName("member_coupon")
public class MemberCoupon {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long memberId;
    private Long couponId;
    private Integer status;
    private LocalDateTime usedTime;
    private Long usedOrderId;
    private LocalDateTime receiveTime;
    private LocalDateTime expireTime;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    @TableLogic
    private Integer deleted;
}