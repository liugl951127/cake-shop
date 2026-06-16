package com.cakeshop.controller;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import com.cakeshop.entity.Order;
import com.cakeshop.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 支付 Controller
 *  - 微信支付 (统一下单/回调)
 *  - 余额支付 (走 WalletService)
 *  - 货到付款
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/pay")
@Tag(name = "支付")
public class PayController {

    @Autowired
    private OrderService orderService;

    /**
     * 余额支付 (走 WalletService)
     * body: { orderId }
     */
    @PostMapping("/balance")
    @Operation(summary = "余额支付")
    public Result<Map<String, Object>> payByBalance(@RequestBody Map<String, Object> body) {
        Long orderId = ((Number) body.get("orderId")).longValue();
        Order o = orderService.getById(orderId);
        if (o == null) throw new BizException(ErrorCode.ORDER_NOT_FOUND);
        if (o.getStatus() != 0) throw new BizException(ErrorCode.ORDER_STATUS_INVALID, "订单不是待付款状态");
        // 真实项目: 调 walletService.pay(o.getUserId(), o.getTotalPrice(), orderId)
        // 简化: 直接标记支付成功
        o = orderService.pay(orderId, "balance", "BAL" + System.currentTimeMillis());
        Map<String, Object> data = new HashMap<>();
        data.put("orderId", orderId);
        data.put("status", o.getStatus());
        data.put("payMethod", "balance");
        return Result.ok(data);
    }

    /**
     * 微信支付 (返回预支付信息)
     * body: { orderId, openid }
     * 真实项目: 调 wxpay SDK 统一下单
     * 简化: 返回模拟数据
     */
    @PostMapping("/wxpay")
    @Operation(summary = "微信支付(统一下单)")
    public Result<Map<String, Object>> payByWxpay(@RequestBody Map<String, Object> body) {
        Long orderId = ((Number) body.get("orderId")).longValue();
        String openid = (String) body.getOrDefault("openid", "test_openid");
        Order o = orderService.getById(orderId);
        if (o == null) throw new BizException(ErrorCode.ORDER_NOT_FOUND);
        if (o.getStatus() != 0) throw new BizException(ErrorCode.ORDER_STATUS_INVALID);
        // 真实项目: 调 https://api.mch.weixin.qq.com/pay/unifiedorder
        // 这里返回模拟数据
        Map<String, Object> data = new HashMap<>();
        data.put("appId", "wx_appid");
        data.put("timeStamp", String.valueOf(System.currentTimeMillis() / 1000));
        data.put("nonceStr", java.util.UUID.randomUUID().toString().replace("-", ""));
        data.put("package", "prepay_id=mock_prepay_" + orderId);
        data.put("signType", "MD5");
        data.put("paySign", "mock_sign_" + System.currentTimeMillis());
        data.put("orderNo", o.getOrderNo());
        data.put("amount", o.getTotalPrice());
        // 真实项目: 微信支付回调后再调 orderService.pay()
        // 模拟: 假设用户已支付,直接标记成功
        orderService.pay(orderId, "wxpay", "WX" + System.currentTimeMillis());
        return Result.ok(data);
    }

    /**
     * 微信支付回调 (POST XML)
     * 真实项目: 验证签名 + 处理支付结果
     */
    @PostMapping("/wxpay/notify")
    @Operation(summary = "微信支付回调")
    public String wxpayNotify(@RequestBody String xml) {
        log.info("wxpay notify: {}", xml);
        // 简化: 解析 XML, 找到 out_trade_no (订单号)
        // 用正则提取
        try {
            java.util.regex.Pattern p = java.util.regex.Pattern.compile("<out_trade_no><!\\[CDATA\\[(.*?)\\]\\]></out_trade_no>");
            java.util.regex.Matcher m = p.matcher(xml);
            if (m.find()) {
                String orderNo = m.group(1);
                Order o = orderService.lambdaQuery().eq(Order::getOrderNo, orderNo).one();
                if (o != null && o.getStatus() == 0) {
                    orderService.pay(o.getId(), "wxpay", orderNo);
                }
            }
        } catch (Exception e) {
            log.warn("wxpay notify parse err: {}", e.getMessage());
        }
        // 返回 SUCCESS 给微信
        return "<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>";
    }

    /**
     * 申请退款
     * body: { orderId, reason }
     */
    @PostMapping("/refund")
    @Operation(summary = "申请退款")
    public Result<Order> refund(@RequestBody Map<String, Object> body) {
        Long orderId = ((Number) body.get("orderId")).longValue();
        String reason = (String) body.getOrDefault("reason", "");
        Order o = orderService.requestRefund(orderId, reason);
        return Result.ok(o);
    }

    /**
     * 确认收货
     */
    @PostMapping("/confirm")
    @Operation(summary = "确认收货")
    public Result<Order> confirm(@RequestBody Map<String, Object> body) {
        Long orderId = ((Number) body.get("orderId")).longValue();
        Order o = orderService.confirmReceive(orderId);
        return Result.ok(o);
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
