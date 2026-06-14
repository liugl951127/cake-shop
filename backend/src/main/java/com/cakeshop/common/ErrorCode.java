package com.cakeshop.common;

import lombok.Getter;

/**
 * 统一错误码(与云函数对齐)
 */
@Getter
public enum ErrorCode {

    OK(0, "ok"),
    FAIL(-1, "操作失败"),

    // 业务错误 1xxx
    BAD_REQUEST(1001, "参数错误"),
    UNAUTHORIZED(1002, "请先登录"),
    TOKEN_EXPIRED(1003, "登录已失效"),
    FORBIDDEN(1004, "无权限"),
    NOT_FOUND(1005, "资源不存在"),
    CONFLICT(1006, "资源冲突"),
    RATE_LIMIT(1007, "操作太频繁"),
    EXPIRED(1008, "已过期"),
    USED(1009, "已使用"),
    OUT_OF_STOCK(1010, "库存不足"),
    AMOUNT_INVALID(1011, "金额无效"),
    RISK_REJECT(1012, "操作已被风控拦截"),
    RISK_VERIFY(1013, "需要补充身份验证"),
    RISK_REVIEW(1014, "正在人工审核"),

    // 订单 2xxx
    ORDER_NOT_FOUND(2001, "订单不存在"),
    ORDER_STATUS_INVALID(2002, "订单状态错误"),
    ORDER_PAID(2003, "订单已支付"),
    ORDER_REFUNDING(2004, "订单退款中"),
    COUPON_USED(2101, "优惠券已使用"),
    COUPON_EXPIRED(2102, "优惠券已过期"),
    COUPON_NOT_MATCH(2103, "优惠券不满足条件"),
    POINTS_NOT_ENOUGH(2201, "积分不足"),
    INVENTORY_NOT_ENOUGH(2301, "库存不足"),
    PERMISSION_DENIED(2401, "权限不足"),

    // 客服/聊天 3xxx
    CHAT_SESSION_NOT_FOUND(3001, "会话不存在"),
    CHAT_SESSION_CLOSED(3002, "会话已关闭"),
    CHAT_NOT_PARTICIPANT(3003, "非会话参与方"),
    CHAT_MESSAGE_TOO_LONG(3004, "消息内容过长"),
    CHAT_MESSAGE_INVALID(3005, "消息格式错误"),
    CHAT_UPLOAD_FAILED(3006, "文件上传失败"),
    CHAT_RICH_TEXT_INVALID(3007, "富文本格式不合法"),

    // 行为埋点 4xxx
    BEHAVIOR_LOG_INVALID(4001, "行为日志格式错误"),
    BEHAVIOR_LOG_TOO_LARGE(4002, "行为日志过大"),
    BEHAVIOR_DEVICE_NOT_FOUND(4003, "设备指纹未识别"),
    HISTORY_QUERY_TOO_MANY(4101, "查询范围过大"),
    HISTORY_EXPORT_FAILED(4102, "导出失败"),

    // 系统错误 5xxx
    SYSTEM_ERROR(5000, "系统异常"),
    DB_ERROR(5001, "数据库异常"),
    CACHE_ERROR(5002, "缓存异常"),
    EXTERNAL_API_ERROR(5003, "外部服务异常"),
    TIMEOUT(5004, "请求超时");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
