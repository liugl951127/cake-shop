package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 异常上报
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("error_reports")
public class ErrorReport extends BaseEntity {
    private String fingerprint;
    private String message;
    private String stack;
    private String type;
    private String scene;
    private String level;
    private String context;     // JSON
    private String tenantId;
    private String userId;
    private String deviceId;
    private Integer count;
    private Long ts;
}
