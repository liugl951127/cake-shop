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

    private String action;             // 操作(create_employee / update_role / refund_approve / etc.)
    private String targetType;         // employee / order / goods / finance
    private String targetId;
    private String operatorId;
    private String operatorName;
    private String operatorRole;
    private String tenantId;           // 多租户
    private String detail;             // JSON
    private String beforeState;        // 变更前快照
    private String afterState;         // 变更后快照
    private String ip;
    private String userAgent;
    private String severity;           // info/warn/critical
    private String result;             // success/fail
    private String errorMsg;
    private Boolean replayable;        // 是否可回放
    private Long ts;                   // 业务时戳
}
