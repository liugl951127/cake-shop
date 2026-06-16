package com.cakeshop.security;

import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.BizException;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.HashMap;

/**
 * 加密机抽象驱动
 *   - 本地软件加密(LocalDriver) - 开发/测试
 *   - 阿里云 KMS (AliyunKmsDriver) - 生产
 *   - 腾讯云 KMS (TencentKmsDriver) - 生产
 */
public abstract class KmsDriver {
    public abstract String getName();

    /** AES-256-GCM 加密 - 返回 {iv, tag, data} base64 */
    public Map<String, String> encrypt(byte[] plain, String keyAlias) {
        throw new UnsupportedOperationException();
    }

    public String decrypt(Map<String, String> cipher, String keyAlias) {
        throw new UnsupportedOperationException();
    }

    public String hmac(String message, String keyAlias) {
        throw new UnsupportedOperationException();
    }
}
