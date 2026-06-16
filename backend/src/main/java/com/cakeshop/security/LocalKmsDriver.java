package com.cakeshop.security;

import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.BizException;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * 本地软件加密驱动(开发/测试)
 *   - 生产环境必须换成真实 KMS(AliyunKmsDriver / TencentKmsDriver)
 *   - 主密钥从 env MASTER_KEY_HEX 读取(32 字节 hex)
 *   - 数据密钥通过 PBKDF2 从 keyAlias 派生
 */
@Component
public class LocalKmsDriver extends KmsDriver {

    private static final int GCM_IV_LEN = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final int PBKDF2_ITER = 10000;
    private static final String ALG = "AES/GCM/NoPadding";

    private final byte[] masterKey;
    private final byte[] keyMaster;
    private final SecureRandom rng = new SecureRandom();

    public LocalKmsDriver() {
        String hex = System.getenv().getOrDefault("MASTER_KEY_HEX",
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
        byte[] mk;
        try {
            mk = hexToBytes(hex);
            if (mk.length != 32) {
                mk = sha256("cake-shop-master".getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception e) {
            mk = sha256("cake-shop-master".getBytes(StandardCharsets.UTF_8));
        }
        this.masterKey = mk;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(masterKey);
            md.update("kdf-master".getBytes(StandardCharsets.UTF_8));
            this.keyMaster = md.digest();
        } catch (Exception e) {
            throw new BizException(ErrorCode.KMS_UNAVAILABLE, "KMS init failed");
        }
    }

    @Override
    public String getName() { return "local-kms"; }

    @Override
    public Map<String, String> encrypt(byte[] plain, String keyAlias) {
        try {
            byte[] key = deriveKey(keyAlias);
            byte[] iv = new byte[GCM_IV_LEN];
            rng.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(ALG);
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ct = cipher.doFinal(plain);
            Map<String, String> r = new HashMap<>();
            r.put("iv", Base64.getEncoder().encodeToString(iv));
            // 拆 tag
            byte[] body = new byte[ct.length - 16];
            byte[] tag = new byte[16];
            System.arraycopy(ct, 0, body, 0, body.length);
            System.arraycopy(ct, body.length, tag, 0, tag.length);
            r.put("data", Base64.getEncoder().encodeToString(body));
            r.put("tag", Base64.getEncoder().encodeToString(tag));
            r.put("alg", "AES-256-GCM");
            r.put("keyAlias", keyAlias == null ? "default" : keyAlias);
            r.put("v", "1");
            return r;
        } catch (Exception e) {
            throw new BizException(ErrorCode.ENCRYPT_FAILED, e.getMessage());
        }
    }

    @Override
    public String decrypt(Map<String, String> cipher, String keyAlias) {
        try {
            if (cipher == null) throw new BizException(ErrorCode.DECRYPT_FAILED, "cipher is null");
            String alias = cipher.getOrDefault("keyAlias", keyAlias == null ? "default" : keyAlias);
            byte[] key = deriveKey(alias);
            byte[] iv = Base64.getDecoder().decode(cipher.get("iv"));
            byte[] body = Base64.getDecoder().decode(cipher.get("data"));
            byte[] tag = Base64.getDecoder().decode(cipher.get("tag"));
            byte[] ct = new byte[body.length + tag.length];
            System.arraycopy(body, 0, ct, 0, body.length);
            System.arraycopy(tag, 0, ct, body.length, tag.length);
            Cipher c = Cipher.getInstance(ALG);
            c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] pt = c.doFinal(ct);
            return new String(pt, StandardCharsets.UTF_8);
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            throw new BizException(ErrorCode.DECRYPT_FAILED, e.getMessage());
        }
    }

    @Override
    public String hmac(String message, String keyAlias) {
        try {
            byte[] key = deriveKey(keyAlias == null ? "hmac" : keyAlias);
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            byte[] sig = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : sig) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new BizException(ErrorCode.HASH_FAILED, e.getMessage());
        }
    }

    private byte[] deriveKey(String keyAlias) {
        try {
            PBEKeySpec spec = new PBEKeySpec(
                    new String(keyMaster, StandardCharsets.UTF_8).toCharArray(),
                    (keyAlias == null ? "default" : keyAlias).getBytes(StandardCharsets.UTF_8),
                    PBKDF2_ITER, 256);
            SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            return skf.generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new BizException(ErrorCode.KDF_FAILED, e.getMessage());
        }
    }

    private static byte[] sha256(byte[] in) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(in);
        } catch (Exception e) {
            return new byte[32];
        }
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
