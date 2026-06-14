package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 租户
 *   status: active/disabled
 *   plan: free/pro/enterprise
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tenants")
public class Tenant extends BaseEntity {
    private String code;
    private String name;
    private String status;
    private String plan;
    private Long expireAt;
    private String quota;       // JSON
    private String contact;     // JSON
    private String remark;
}
