package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 风控日志
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("risk_log")
public class RiskLog extends BaseEntity {

    private String scenario;        // pay/withdraw/login/register
    private Long userId;
    private String openid;
    private String deviceId;
    private String ip;
    private String phone;
    private String idCardHash;
    private Long orderId;
    private java.math.BigDecimal amount;
    private String factors;         // JSON
    private Integer totalScore;
    private Integer threshold;      // reject 阈值
    private String decision;        // pass/verify/manual/reject
    private String requireAction;   // JSON
    private String reviewStatus;    // auto/pending/approved/rejected
    private String reviewBy;
    private String reviewNote;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime reviewTime;
}
