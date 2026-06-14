package com.cakeshop.controller;

import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 资源访问 token 签发 + 校验(对应微信小程序 /auth/token、/auth/verify)
 * 位置/媒体/文件访问都需要先签 token
 */
@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth 资源授权", description = "资源访问 token 签发、验证(位置/媒体/文件)")
public class AuthController {

    private static final String SECRET = "cake-shop-auth-2024-32bytes!";
    private static final long DEFAULT_TTL = 60L;
    private static final long MAX_TTL = 600L;

    @PostMapping("/token")
    @Operation(summary = "签发资源访问 token")
    public Result<Map<String, Object>> signToken(@RequestBody Map<String, Object> req) {
        try {
            String resourceType = (String) req.get("resourceType");
            String resourceId = (String) req.get("resourceId");
            Object userIdObj = req.get("userId");
            String scope = (String) req.getOrDefault("scope", "private");
            Number ttlNum = (Number) req.getOrDefault("ttl", DEFAULT_TTL);
            long ttl = Math.min(ttlNum.longValue(), MAX_TTL);
            if (ttl <= 0) ttl = DEFAULT_TTL;

            if (resourceType == null || resourceType.isEmpty()) {
                return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "resourceType 必填");
            }
            if (resourceId == null || resourceId.isEmpty()) {
                return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "resourceId 必填");
            }
            // 位置资源额外校验
            if ("location".equals(resourceType)) {
                Object location = req.get("location");
                if (location == null) {
                    return Result.fail(ErrorCode.AUTH_LOCATION_DENIED.getCode(), "位置信息缺失");
                }
            }
            // 文件大小校验
            if ("file".equals(resourceType) || "image".equals(resourceType)
                    || "video".equals(resourceType) || "audio".equals(resourceType)) {
                Object sizeObj = req.get("size");
                if (sizeObj != null) {
                    long size = ((Number) sizeObj).longValue();
                    if (size > 50L * 1024L * 1024L) {
                        return Result.fail(ErrorCode.AUTH_FILE_TOO_LARGE.getCode(), "文件超过 50MB");
                    }
                }
            }

            long exp = System.currentTimeMillis() + ttl * 1000L;
            String nonce = UUID.randomUUID().toString().replace("-", "");
            String userId = userIdObj == null ? "" : String.valueOf(userIdObj);

            String body = resourceType + "|" + resourceId + "|" + userId + "|" + scope
                    + "|" + exp + "|" + nonce;
            String sig = hmacSha256(body, SECRET);
            String token = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(body.getBytes(StandardCharsets.UTF_8)) + "." + sig;

            Map<String, Object> data = new HashMap<>();
            data.put("token", token);
            data.put("expiresAt", exp);
            data.put("expiresIn", ttl);
            data.put("resourceType", resourceType);
            data.put("resourceId", resourceId);
            return Result.ok(data);
        } catch (Exception e) {
            return Result.fail(ErrorCode.SYSTEM_ERROR.getCode(), e.getMessage());
        }
    }

    @PostMapping("/verify")
    @Operation(summary = "校验资源访问 token")
    public Result<Map<String, Object>> verifyToken(@RequestBody Map<String, Object> req) {
        try {
            String token = (String) req.get("token");
            if (token == null) {
                return Result.fail(ErrorCode.AUTH_TOKEN_INVALID.getCode(), "token 必填");
            }
            String[] parts = token.split("\\.");
            if (parts.length != 2) {
                return Result.fail(ErrorCode.AUTH_TOKEN_INVALID.getCode(), "token 格式错误");
            }
            String body = new String(Base64.getUrlDecoder().decode(parts[0]),
                    StandardCharsets.UTF_8);
            String expectSig = hmacSha256(body, SECRET);
            if (!expectSig.equals(parts[1])) {
                return Result.fail(ErrorCode.AUTH_URL_SIGN_INVALID.getCode(), "签名错误");
            }
            String[] fields = body.split("\\|");
            if (fields.length < 6) {
                return Result.fail(ErrorCode.AUTH_TOKEN_INVALID.getCode(), "token 内容错误");
            }
            long exp = Long.parseLong(fields[4]);
            if (exp < System.currentTimeMillis()) {
                return Result.fail(ErrorCode.AUTH_URL_EXPIRED.getCode(), "token 已过期");
            }
            Map<String, Object> data = new HashMap<>();
            data.put("resourceType", fields[0]);
            data.put("resourceId", fields[1]);
            data.put("userId", fields[2]);
            data.put("scope", fields[3]);
            data.put("expiresAt", exp);
            return Result.ok(data);
        } catch (Exception e) {
            return Result.fail(ErrorCode.AUTH_TOKEN_INVALID.getCode(), e.getMessage());
        }
    }

    @GetMapping("/scopes")
    @Operation(summary = "列出支持的所有 scope(供前端/文档查询)")
    public Result<Map<String, Object>> scopes() {
        Map<String, Object> map = new HashMap<>();
        map.put("userLocation", "精确位置");
        map.put("camera", "相机");
        map.put("album", "相册");
        map.put("microphone", "麦克风");
        map.put("file", "文件");
        map.put("readPhotosAlbum", "读取相册");
        map.put("writePhotosAlbum", "保存到相册");
        map.put("bluetooth", "蓝牙");
        map.put("notifications", "通知");
        return Result.ok(map);
    }

    @PostMapping("/location/validate")
    @Operation(summary = "校验位置(范围 + 精度)")
    public Result<Map<String, Object>> validateLocation(@RequestBody Map<String, Object> req) {
        try {
            double lat = ((Number) req.get("latitude")).doubleValue();
            double lng = ((Number) req.get("longitude")).doubleValue();
            double acc = req.get("accuracy") == null ? 0
                    : ((Number) req.get("accuracy")).doubleValue();
            String scope = (String) req.getOrDefault("scope", "CN");

            double[] latRange = scope.equals("GLOBAL") ? new double[]{-90, 90} : new double[]{3.86, 53.55};
            double[] lngRange = scope.equals("GLOBAL") ? new double[]{-180, 180} : new double[]{73.66, 135.05};

            if (lat < latRange[0] || lat > latRange[1] || lng < lngRange[0] || lng > lngRange[1]) {
                return Result.fail(ErrorCode.AUTH_LOCATION_OUT_OF_RANGE.getCode(), "位置不在服务范围");
            }
            if (acc > 0 && acc > 500) {
                return Result.fail(ErrorCode.AUTH_LOCATION_PRECISION_LOW.getCode(),
                        "位置精度不足: " + acc + "m");
            }
            Map<String, Object> data = new HashMap<>();
            data.put("valid", true);
            data.put("latitude", lat);
            data.put("longitude", lng);
            data.put("accuracy", acc);
            data.put("validatedAt", System.currentTimeMillis());
            return Result.ok(data);
        } catch (Exception e) {
            return Result.fail(ErrorCode.AUTH_LOCATION_DENIED.getCode(), e.getMessage());
        }
    }

    private static String hmacSha256(String data, String key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] sig = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : sig) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
