package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * CMS 页
 * 对应表 cms_page
 */
@Data
@TableName("cms_page")
public class CmsPage {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String key;
    private String title;
    private String content;
    private String extra;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    @TableLogic
    private Integer deleted;
}