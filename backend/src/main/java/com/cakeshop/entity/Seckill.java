package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 限时秒杀
 * 对应表 seckill
 */
@Data
@TableName("seckill")
public class Seckill {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long goodsId;
    private String name;
    private String image;
    private BigDecimal seckillPrice;
    private BigDecimal originPrice;
    private Integer stock;
    private Integer total;
    private Integer sold;
    private Integer perLimit;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    @TableLogic
    private Integer deleted;
}