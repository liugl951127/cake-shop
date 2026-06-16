package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("member")
public class Member {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String openid;
    private String nickname;
    private String avatar;
    private String phone;
    private String level;
    private Integer growth;
    private BigDecimal balance;
    private BigDecimal frozen;
    private Integer points;
    private BigDecimal totalSpend;
    private BigDecimal discount;
    private Integer isAdmin;
    private Integer status;
    private LocalDateTime registerTime;
    private LocalDateTime lastLoginTime;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    @TableLogic
    private Integer deleted;
}
