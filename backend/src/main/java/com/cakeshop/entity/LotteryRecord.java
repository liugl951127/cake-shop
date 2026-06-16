package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 中奖记录
 * 对应表 lottery_record
 */
@Data
@TableName("lottery_record")
public class LotteryRecord {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private Long prizeId;
    private String prizeName;
    private String prizeType;
    private Integer status;
    private LocalDateTime claimedTime;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    @TableLogic
    private Integer deleted;
}