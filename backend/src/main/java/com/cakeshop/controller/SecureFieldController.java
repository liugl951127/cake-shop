package com.cakeshop.controller;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import com.cakeshop.security.PaymentCryptoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * 安全输入 API(对应云函数 setPaymentPassword/verifyPaymentPassword/sendSmsCode/verifySmsCode/secureFieldEncrypt/secureFieldDecrypt)
 *   - 设置 / 修改付款密码
 *   - 校验付款密码
 *   - 发送 / 校验短信验证码
 *   - 通用安全字段加密 / 解密(身份证/银行卡)
 */
@RestController
@RequestMapping("/api/v1/secure")
@Tag(name = "Secure 安全输入", description = "付款密码 / 短信验证码 / 敏感字段加密")
public class SecureFieldController {

    @Autowired
    private PaymentCryptoService crypto;

    private static final Pattern PHONE = Pattern.compile("^1[3-9]\\d{9}$");
    private static final ConcurrentHashMap<String, Long> NONCE = new ConcurrentHashMap<>();

    // =================== 付款密码 ===================

    @PostMapping("/payment-password/set")
    @Operation(summary = "设置 / 修改付款密码")
    public Result<Map<String, Object>> setPaymentPassword(@RequestBody Map<String, Object> req) {
        String userId = (String) req.get("userId");
        String password = (String) req.get("password");
        String oldPassword = (String) req.get("oldPassword");
        if (userId == null || userId.isEmpty()) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "userId 必填");
        }
        if (password == null) {
            return Result.fail(ErrorCode.PAYMENT_PASSWORD_FORMAT_ERROR.getCode(), "password 必填");
        }
        try {
            // TODO: 真实场景要从 user_secure_fields 查旧 hash
            PaymentCryptoService.PasswordHash newHash = crypto.hashPassword(password);
            Map<String, Object> data = new HashMap<>();
            data.put("set", true);
            data.put("setAt", newHash.getSetAt());
            return Result.ok(data);
        } catch (BizException e) {
            return Result.fail(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.fail(ErrorCode.SYSTEM_ERROR.getCode(), e.getMessage());
        }
    }

    @PostMapping("/payment-password/verify")
    @Operation(summary = "校验付款密码(支付流程)")
    public Result<Map<String, Object>> verifyPaymentPassword(@RequestBody Map<String, Object> req) {
        String userId = (String) req.get("userId");
        String password = (String) req.get("password");
        String businessKey = (String) req.getOrDefault("businessKey", "pay");
        @SuppressWarnings("unchecked")
        Map<String, Object> businessData = (Map<String, Object>) req.get("businessData");
        if (userId == null) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "userId 必填");
        }
        if (password == null) {
            return Result.fail(ErrorCode.PAYMENT_PASSWORD_FORMAT_ERROR.getCode(), "password 必填");
        }
        // TODO: 真实场景从 user_secure_fields 查
        // 这里 demo 不存 DB,直接用模拟 hash
        PaymentCryptoService.PasswordHash demo = crypto.hashPassword("123456");
        try {
            crypto.verifyPassword(userId, password, demo);
            // 签发 payToken
            String payToken = "st_" + System.currentTimeMillis() + "_"
                    + Integer.toHexString((int) (Math.random() * 0xfffff));
            Map<String, Object> data = new HashMap<>();
            data.put("verified", true);
            data.put("payToken", payToken);
            return Result.ok(data);
        } catch (BizException e) {
            return Result.fail(e.getCode(), e.getMessage());
        }
    }

    // =================== 短信验证码 ===================

    @PostMapping("/sms/send")
    @Operation(summary = "发送短信验证码")
    public Result<Map<String, Object>> sendSmsCode(@RequestBody Map<String, Object> req) {
        String phone = (String) req.get("phone");
        String purpose = (String) req.get("purpose");
        if (phone == null || !PHONE.matcher(phone).matches()) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "手机号格式错");
        }
        if (purpose == null) purpose = "verify";
        try {
            crypto.checkSmsSendInterval(phone);
            PaymentCryptoService.SmsCode sc = crypto.generateSmsCode();
            crypto.storeSmsCode(phone, sc);
            // TODO: 调短信网关
            // dev: 在日志打印
            org.slf4j.LoggerFactory.getLogger(SecureFieldController.class)
                    .info("sms code (dev only): code={} phone={} purpose={}",
                            sc.getCode(), phone.replaceAll("(\\d{3})\\d{4}(\\d{4})", "$1****$2"), purpose);
            Map<String, Object> data = new HashMap<>();
            data.put("sent", true);
            data.put("expireAt", sc.getExpireAt());
            data.put("expireIn", 300);
            data.put("maskedPhone", phone.replaceAll("(\\d{3})\\d{4}(\\d{4})", "$1****$2"));
            return Result.ok(data);
        } catch (BizException e) {
            return Result.fail(e.getCode(), e.getMessage());
        }
    }

    @PostMapping("/sms/verify")
    @Operation(summary = "校验短信验证码")
    public Result<Map<String, Object>> verifySmsCode(@RequestBody Map<String, Object> req) {
        String phone = (String) req.get("phone");
        String code = (String) req.get("code");
        String purpose = (String) req.getOrDefault("purpose", "verify");
        if (phone == null || !PHONE.matcher(phone).matches()) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "手机号格式错");
        }
        if (code == null) {
            return Result.fail(ErrorCode.SMS_CODE_FORMAT_ERROR.getCode(), "code 必填");
        }
        try {
            crypto.verifySmsCode(phone, code);
            String verifyToken = "st_" + System.currentTimeMillis() + "_v"
                    + Integer.toHexString((int) (Math.random() * 0xfffff));
            Map<String, Object> data = new HashMap<>();
            data.put("verified", true);
            data.put("verifyToken", verifyToken);
            return Result.ok(data);
        } catch (BizException e) {
            return Result.fail(e.getCode(), e.getMessage());
        }
    }

    // =================== 通用安全字段 ===================

    @PostMapping("/field/encrypt")
    @Operation(summary = "加密通用安全字段(身份证/银行卡)")
    public Result<Map<String, Object>> encryptField(@RequestBody Map<String, Object> req) {
        String fieldType = (String) req.get("fieldType");
        String value = (String) req.get("value");
        String keyAlias = (String) req.getOrDefault("keyAlias", "default");
        if (fieldType == null) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "fieldType 必填");
        }
        if (value == null) {
            return Result.fail(ErrorCode.SECURE_FIELD_INVALID.getCode(), "value 必填");
        }
        try {
            Map<String, String> cipher = crypto.encryptField(fieldType, value, keyAlias);
            Map<String, Object> data = new HashMap<>(cipher);
            return Result.ok(data);
        } catch (BizException e) {
            return Result.fail(e.getCode(), e.getMessage());
        }
    }

    @PostMapping("/field/decrypt")
    @Operation(summary = "解密(仅服务端内部用)")
    public Result<Map<String, Object>> decryptField(@RequestBody Map<String, Object> req) {
        @SuppressWarnings("unchecked")
        Map<String, String> cipher = (Map<String, String>) req.get("cipher");
        String keyAlias = (String) req.getOrDefault("keyAlias", "default");
        if (cipher == null) {
            return Result.fail(ErrorCode.SECURE_FIELD_INVALID.getCode(), "cipher 必填");
        }
        try {
            String value = crypto.decryptField(cipher, keyAlias);
            Map<String, Object> data = new HashMap<>();
            data.put("value", value);
            return Result.ok(data);
        } catch (BizException e) {
            return Result.fail(e.getCode(), e.getMessage());
        }
    }

    @GetMapping("/policy")
    @Operation(summary = "查询安全策略(风控/锁定/密码强度)")
    public Result<Map<String, Object>> policy() {
        Map<String, Object> data = new HashMap<>();
        Map<String, Object> ppwd = new HashMap<>();
        ppwd.put("length", 6);
        ppwd.put("pattern", "^\\d{6}$");
        ppwd.put("maxAttempts", 5);
        ppwd.put("lockSeconds", 90);
        data.put("paymentPassword", ppwd);
        Map<String, Object> sms = new HashMap<>();
        sms.put("length", 6);
        sms.put("pattern", "^\\d{6}$");
        sms.put("expireSeconds", 300);
        sms.put("sendInterval", 60);
        sms.put("dailyLimit", 10);
        sms.put("maxAttempts", 5);
        sms.put("lockSeconds", 60);
        data.put("smsCode", sms);
        return Result.ok(data);
    }
}
