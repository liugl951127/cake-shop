package com.cakeshop.security;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.cache.LocalCache;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 付款密码 + 短信验证码 + 通用安全字段服务
 *   1. hashPassword / verifyPassword (PBKDF2-SHA256)
 *   2. SmsCode (cache 中只存 hash, 5 分钟过期, 单次性)
 *   3. 风控: 5 次错误 → 锁定 90s (密码) / 60s (短信)
 */
@Service
public class PaymentCryptoService {

    private static final int PBKDF2_ITER = 100000;
    private static final int SALT_LEN = 16;
    private static final int KEY_LEN = 32;

    private static final int PPWD_MAX_ATTEMPTS = 5;
    private static final int PPWD_LOCK_SECONDS = 90;
    private static final int SMS_MAX_ATTEMPTS = 5;
    private static final int SMS_LOCK_SECONDS = 60;
    private static final int SMS_EXPIRE_SECONDS = 300;
    private static final int SMS_SEND_INTERVAL = 60;
    private static final int SMS_DAILY_LIMIT = 10;

    @Autowired
    private KmsDriver kms;

    private final SecureRandom rng = new SecureRandom();

    // =================== 密码 ===================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PasswordHash {
        private String salt;
        private String hash;
        private Integer iters;
        private String alg;
        private Long setAt;
    }

    public PasswordHash hashPassword(String password) {
        validatePasswordFormat(password);
        String salt = randomHex(SALT_LEN);
        String hash = pbkdf2(password, salt, PBKDF2_ITER, KEY_LEN);
        return new PasswordHash(salt, hash, PBKDF2_ITER, "pbkdf2-sha256", System.currentTimeMillis());
    }

    public void verifyPassword(String userId, String password, PasswordHash stored) {
        validatePasswordFormat(password);
        String lockKey = "ppwd:lock:" + userId;
        String errKey = "ppwd:err:" + userId;
        Long lockUntil = LocalCache.get(lockKey, Long.class);
        if (lockUntil != null && lockUntil > System.currentTimeMillis()) {
            long left = (lockUntil - System.currentTimeMillis()) / 1000;
            throw new BizException(ErrorCode.PAYMENT_PASSWORD_LOCKED,
                    "已锁定," + left + "秒后再试");
        }
        if (stored == null || stored.getHash() == null || stored.getSalt() == null) {
            throw new BizException(ErrorCode.PAYMENT_PASSWORD_FORMAT_ERROR, "未设置密码");
        }
        String computed = pbkdf2(password, stored.getSalt(),
                stored.getIters() == null ? PBKDF2_ITER : stored.getIters(),
                stored.getHash().length() / 2);
        if (!constantTimeEquals(computed, stored.getHash())) {
            Integer errs = LocalCache.get(errKey, Integer.class);
            errs = errs == null ? 1 : errs + 1;
            LocalCache.set(errKey, errs, 600);
            if (errs >= PPWD_MAX_ATTEMPTS) {
                long until = System.currentTimeMillis() + PPWD_LOCK_SECONDS * 1000L;
                LocalCache.set(lockKey, until, PPWD_LOCK_SECONDS);
                LocalCache.del(errKey);
                throw new BizException(ErrorCode.PAYMENT_PASSWORD_LOCKED,
                        "已连续错误 " + errs + " 次,锁定 " + PPWD_LOCK_SECONDS + " 秒");
            }
            throw new BizException(ErrorCode.PAYMENT_PASSWORD_INCORRECT,
                    "密码错误,还剩 " + (PPWD_MAX_ATTEMPTS - errs) + " 次机会");
        }
        LocalCache.del(errKey);
        LocalCache.del(lockKey);
    }

    public PasswordHash changePassword(String userId, String oldPwd, String newPwd, PasswordHash stored) {
        verifyPassword(userId, oldPwd, stored);
        return hashPassword(newPwd);
    }

    // =================== 短信验证码 ===================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SmsCode {
        private String code;
        private String hash;
        private String salt;
        private Long expireAt;
    }

    public SmsCode generateSmsCode() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) sb.append(rng.nextInt(10));
        String code = sb.toString();
        String salt = randomHex(8);
        String hash = pbkdf2(code, salt, 10000, 16);
        return new SmsCode(code, hash, salt, System.currentTimeMillis() + SMS_EXPIRE_SECONDS * 1000L);
    }

    public void storeSmsCode(String phone, SmsCode sc) {
        String key = "sms:" + phone;
        Map<String, Object> data = new HashMap<>();
        data.put("hash", sc.getHash());
        data.put("salt", sc.getSalt());
        data.put("expireAt", sc.getExpireAt());
        LocalCache.set(key, data, SMS_EXPIRE_SECONDS);
    }

    public void verifySmsCode(String phone, String code) {
        if (code == null || !code.matches("^\\d{6}$")) {
            throw new BizException(ErrorCode.SMS_CODE_FORMAT_ERROR);
        }
        String lockKey = "sms:lock:" + phone;
        String errKey = "sms:err:" + phone;
        Long lockUntil = LocalCache.get(lockKey, Long.class);
        if (lockUntil != null && lockUntil > System.currentTimeMillis()) {
            long left = (lockUntil - System.currentTimeMillis()) / 1000;
            throw new BizException(ErrorCode.SMS_CODE_TOO_MANY,
                    "尝试过多," + left + "秒后再试");
        }
        String key = "sms:" + phone;
        @SuppressWarnings("unchecked")
        Map<String, Object> stored = LocalCache.get(key, Map.class);
        if (stored == null) {
            throw new BizException(ErrorCode.SMS_CODE_NOT_FOUND, "验证码不存在或已过期");
        }
        Long exp = (Long) stored.get("expireAt");
        if (exp != null && exp < System.currentTimeMillis()) {
            LocalCache.del(key);
            throw new BizException(ErrorCode.SMS_CODE_EXPIRED, "验证码已过期");
        }
        String salt = (String) stored.get("salt");
        String hash = (String) stored.get("hash");
        String codeHash = pbkdf2(code, salt, 10000, 16);
        if (!constantTimeEquals(codeHash, hash)) {
            Integer errs = LocalCache.get(errKey, Integer.class);
            errs = errs == null ? 1 : errs + 1;
            LocalCache.set(errKey, errs, 600);
            if (errs >= SMS_MAX_ATTEMPTS) {
                long until = System.currentTimeMillis() + SMS_LOCK_SECONDS * 1000L;
                LocalCache.set(lockKey, until, SMS_LOCK_SECONDS);
                LocalCache.del(errKey);
                throw new BizException(ErrorCode.SMS_CODE_TOO_MANY,
                        "已连续错误 " + errs + " 次,锁定 " + SMS_LOCK_SECONDS + " 秒");
            }
            throw new BizException(ErrorCode.SMS_CODE_INCORRECT,
                    "验证码错误,还剩 " + (SMS_MAX_ATTEMPTS - errs) + " 次机会");
        }
        LocalCache.del(key);
        LocalCache.del(errKey);
        LocalCache.del(lockKey);
    }

    public void checkSmsSendInterval(String phone) {
        String lastKey = "sms:last:" + phone;
        Long last = LocalCache.get(lastKey, Long.class);
        if (last != null && (System.currentTimeMillis() - last) < SMS_SEND_INTERVAL * 1000L) {
            long left = (SMS_SEND_INTERVAL * 1000L - (System.currentTimeMillis() - last)) / 1000;
            throw new BizException(ErrorCode.SMS_SEND_TOO_FREQUENT, left + "秒后再发");
        }
        String dayKey = "sms:day:" + phone + ":" + java.time.LocalDate.now();
        Integer today = LocalCache.get(dayKey, Integer.class);
        today = today == null ? 1 : today + 1;
        if (today > SMS_DAILY_LIMIT) {
            throw new BizException(ErrorCode.SMS_DAILY_LIMIT, "今日已达 " + SMS_DAILY_LIMIT + " 条上限");
        }
        LocalCache.set(lastKey, System.currentTimeMillis(), 120);
        LocalCache.set(dayKey, today, 86400);
    }

    // =================== 加密机加密 ===================

    public Map<String, String> encryptField(String fieldType, String value, String keyAlias) {
        validateFieldType(fieldType, value);
        return kms.encrypt(value.getBytes(StandardCharsets.UTF_8), keyAlias);
    }

    public String decryptField(Map<String, String> cipher, String keyAlias) {
        return kms.decrypt(cipher, keyAlias);
    }

    // =================== 工具 ===================

    private void validatePasswordFormat(String pwd) {
        if (pwd == null || !pwd.matches("^\\d{6}$")) {
            throw new BizException(ErrorCode.PAYMENT_PASSWORD_FORMAT_ERROR, "密码必须 6 位数字");
        }
        if (isWeakPassword(pwd)) {
            throw new BizException(ErrorCode.PAYMENT_PASSWORD_TOO_WEAK, "密码过于简单");
        }
    }

    private void validateFieldType(String type, String value) {
        if (value == null || value.isEmpty()) {
            throw new BizException(ErrorCode.SECURE_FIELD_INVALID, "value 必填");
        }
        if ("idcard".equals(type) && !value.matches("^\\d{17}[\\dXx]$")) {
            throw new BizException(ErrorCode.SECURE_FIELD_INVALID, "身份证格式错");
        }
        if ("bankcard".equals(type) && !value.matches("^\\d{16,19}$")) {
            throw new BizException(ErrorCode.SECURE_FIELD_INVALID, "银行卡格式错");
        }
    }

    private boolean isWeakPassword(String pwd) {
        if (pwd.matches("^(\\d)\\1+$")) return true;
        String[] weak = {"123456", "654321", "111111", "000000", "999999",
                "012345", "987654", "121212", "131313"};
        for (String w : weak) if (w.equals(pwd)) return true;
        boolean asc = true, desc = true;
        for (int i = 1; i < pwd.length(); i++) {
            if (Character.getNumericValue(pwd.charAt(i)) != Character.getNumericValue(pwd.charAt(i - 1)) + 1) asc = false;
            if (Character.getNumericValue(pwd.charAt(i)) != Character.getNumericValue(pwd.charAt(i - 1)) - 1) desc = false;
        }
        return asc || desc;
    }

    private String pbkdf2(String password, String saltHex, int iter, int keyLen) {
        try {
            byte[] salt = hexToBytes(saltHex);
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iter, keyLen * 8);
            SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            return bytesToHex(skf.generateSecret(spec).getEncoded());
        } catch (Exception e) {
            throw new BizException(ErrorCode.KDF_FAILED, e.getMessage());
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) return false;
        int r = 0;
        for (int i = 0; i < a.length(); i++) r |= a.charAt(i) ^ b.charAt(i);
        return r == 0;
    }

    private String randomHex(int len) {
        byte[] b = new byte[len];
        rng.nextBytes(b);
        return bytesToHex(b);
    }

    private static String bytesToHex(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    private static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] out = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            out[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return out;
    }
}
