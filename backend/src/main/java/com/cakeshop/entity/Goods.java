package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/**
 * 商品
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("goods")
public class Goods extends BaseEntity {

    private String name;
    private String description;
    private String image;
    private String images;          // JSON 数组
    private BigDecimal price;
    private BigDecimal originPrice;
    private BigDecimal costPrice;
    private Integer stock;
    private Integer sales;
    private Long categoryId;
    private String categoryName;
    private Long shopId;
    private String tags;            // JSON 数组
    private String specs;           // JSON
    private Integer status;         // 0 下架 1 上架
    private Boolean featured;
    private Integer sort;
}
