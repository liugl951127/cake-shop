package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 拼团
 * 对应表 group_buy
 */
@Data
@TableName("group_buy")
public class GroupBuy {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long goodsId;
    private String name;
    private String image;
    private BigDecimal groupPrice;
    private BigDecimal originPrice;
    private Integer peopleNum;
    private Integer hours;
    private Integer stock;
    private Integer sold;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    @TableLogic
    private Integer deleted;
}