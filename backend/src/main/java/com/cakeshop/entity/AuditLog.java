package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 审计日志(所有敏感操作留痕)
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("audit_logs")
public class AuditLog extends BaseEntity {

    private String operatorId;
    private String operatorName;
    private String action;        // create_employee / update_role / refund_approve / etc.
    private String targetType;    // employee / order / goods / finance
    private String targetId;
    private String detail;        // JSON
    private String ip;
    private String userAgent;
}
