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

    // 多租户 42xx
    TENANT_NOT_FOUND(4201, "租户不存在"),
    TENANT_DISABLED(4202, "租户已禁用"),
    TENANT_EXPIRED(4203, "租户已到期"),
    TENANT_QUOTA_EXCEEDED(4204, "租户额度已用完"),
    TENANT_ISOLATION_DENIED(4205, "不允许跨租户访问"),

    // 审计/回放 43xx
    AUDIT_LOG_FAILED(4301, "审计日志记录失败"),
    REPLAY_SNAPSHOT_MISSING(4302, "回放快照缺失"),
    REPLAY_EXPIRED(4303, "回放记录已过期"),

    // 性能/监控 44xx
    METRIC_INVALID(4401, "指标格式错误"),
    METRIC_AGGREGATE_FAILED(4402, "指标聚合失败"),
    ALREADY_REPORTED(4403, "已上报过同一错误"),

    // 设备/兼容性 45xx
    DEVICE_INFO_INVALID(4501, "设备信息格式错误"),
    UNSUPPORTED_PLATFORM(4502, "不支持的平台"),
    SCREEN_BREAKPOINT_INVALID(4503, "屏幕断点不合法"),

    // 断线/重连 46xx
    WS_DISCONNECTED(4601, "WS连接已断开"),
    WS_RECONNECT_FAILED(4602, "WS重连失败"),
    WS_SESSION_LOST(4603, "WS会话丢失"),
    WS_HEARTBEAT_TIMEOUT(4604, "WS心跳超时"),

    // 离线操作 47xx
    OFFLINE_OP_TOO_OLD(4701, "离线操作已过期"),
    OFFLINE_OP_INVALID(4702, "离线操作格式错误"),
    OFFLINE_OP_REPLAY_DUPLICATE(4703, "离线操作重复回放"),
    OFFLINE_OP_PAYLOAD_TOO_LARGE(4704, "离线操作包过大"),

    // 授权 51xx-53xx
    AUTH_DENIED(5101, "未授权"),
    AUTH_LOCATION_DENIED(5102, "位置权限被拒绝"),
    AUTH_CAMERA_DENIED(5103, "相机权限被拒绝"),
    AUTH_ALBUM_DENIED(5104, "相册权限被拒绝"),
    AUTH_MIC_DENIED(5105, "麦克风权限被拒绝"),
    AUTH_FILE_DENIED(5106, "文件访问被拒绝"),
    AUTH_NEVER_ASK_AGAIN(5107, "权限已被永久拒绝,请到设置开启"),
    AUTH_NOT_GRANTED_YET(5108, "尚未询问过该权限"),
    AUTH_TOKEN_INVALID(5201, "授权令牌无效"),
    AUTH_TOKEN_EXPIRED(5202, "授权令牌已过期"),
    AUTH_TOKEN_MISMATCH(5203, "授权令牌不匹配"),
    AUTH_URL_SIGN_INVALID(5204, "临时URL签名无效"),
    AUTH_URL_EXPIRED(5205, "临时URL已过期"),
    AUTH_FILE_TOO_LARGE(5301, "文件超过大小限制"),
    AUTH_FILE_TYPE_DENIED(5302, "文件类型不支持"),
    AUTH_LOCATION_OUT_OF_RANGE(5303, "位置超出服务范围"),
    AUTH_LOCATION_PRECISION_LOW(5304, "位置精度不足"),

    // 企业微信 48xx
    WECOM_CONFIG_MISSING(4801, "企业微信配置缺失"),
    WECOM_TOKEN_FETCH_FAIL(4802, "access_token 获取失败"),
    WECOM_SIGN_INVALID(4803, "签名校验失败"),
    WECOM_DECRYPT_FAIL(4804, "消息解密失败"),
    WECOM_API_ERROR(4805, "企业微信 API 错误"),
    WECOM_KF_ACCOUNT_MISSING(4806, "客服账号未配置"),
    WECOM_MSG_SEND_FAIL(4807, "消息发送失败"),
    WECOM_CALLBACK_INVALID(4808, "回调校验失败"),

    // 转接 49xx
    TRANSFER_NO_AGENT(4901, "无可用客服"),
    TRANSFER_FAILED(4902, "转接失败"),
    TRANSFER_NOT_ALLOWED(4903, "不允许转接"),
    TRANSFER_LOG_MISSING(4904, "转接记录缺失"),

    // 会话生命周期 50xx
    SESSION_ALREADY_CLOSED(5001, "会话已关闭"),
    SESSION_ALREADY_TRANSFERRED(5002, "会话已转接"),
    SESSION_NOT_ASSIGNED(5003, "会话未分配"),
    SESSION_NO_PERMISSION(5004, "无会话权限"),
    HANGUP_NOT_ALLOWED(5005, "不允许挂断"),
    HANGUP_BY_OTHER(5006, "已被对方挂断"),
    WECOM_MSG_TYPE_INVALID(5007, "企微消息类型无效"),
    WECOM_REPLY_RATE_LIMIT(5008, "回复过于频繁"),

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
