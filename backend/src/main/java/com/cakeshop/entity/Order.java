package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单
 *   status: 0 待付款 1 已付款 2 配送中 3 待收货 4 已完成
 *           -1 已取消 -2 已退款 -3 风控拦截
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("orders")
public class Order extends BaseEntity {

    private String orderNo;
    private String outTradeNo;
    private String transactionId;
    private Long userId;
    private String openid;
    private Long shopId;
    private String shopName;
    private Integer status;
    private Integer dispatchStatus;
    private Long riderId;
    private String riderName;
    private String address;        // JSON
    private String goods;           // JSON
    private String remark;
    private BigDecimal goodsPrice;
    private BigDecimal freight;
    private BigDecimal memberDiscount;
    private BigDecimal couponDiscount;
    private BigDecimal pointsDiscount;
    private BigDecimal promoDiscount;
    private BigDecimal totalPrice;
    private Integer isSelfPickup;
    private String storeId;
    private Boolean isGift;
    private String giftMsg;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime payTime;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime shipTime;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime completeTime;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime expireTime;
}
