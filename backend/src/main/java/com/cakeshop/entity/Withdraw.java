package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 提现
 * 对应表 withdraw
 */
@Data
@TableName("withdraw")
public class Withdraw {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private BigDecimal amount;
    private BigDecimal fee;
    private BigDecimal actual;
    private String account;
    private String accountName;
    private Integer status;
    private LocalDateTime auditTime;
    private String auditBy;
    private String auditNote;
    private LocalDateTime payTime;
    private String payTradeNo;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    @TableLogic
    private Integer deleted;
}