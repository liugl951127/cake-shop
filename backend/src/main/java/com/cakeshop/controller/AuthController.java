package com.cakeshop.controller;

import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import lombok.extern.slf4j.Slf4j;

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
@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth 资源授权", description = "资源访问 token 签发、验证(位置/媒体/文件)")
public class AuthController {
    @Autowired private com.cakeshop.security.JwtUtil jwtUtil;
    @Autowired private com.cakeshop.service.EmployeeService employeeService;

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


    /**
     * 登录 (vue 后台)
     * POST /api/v1/auth/login
     * body: { username, password }
     */
    @PostMapping("/login")
    @Operation(summary = "登录(后台管理)")
    public Result<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        // 1) 参数校验(必填 + 限长 + trim)
        if (body == null) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "请求体不能为空");
        }
        String username = body.get("username");
        String password = body.get("password");
        if (username == null || username.trim().isEmpty()) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "用户名不能为空");
        }
        if (password == null || password.isEmpty()) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "密码不能为空");
        }
        // 限长:防 DB 撑爆
        if (username.length() > 50) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "用户名过长(>50)");
        }
        if (password.length() > 200) {
            return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "密码过长(>200)");
        }
        username = username.trim();  // 去掉前后空格

        // 2) 查用户
        com.cakeshop.entity.Employee e = employeeService.lambdaQuery()
            .eq(com.cakeshop.entity.Employee::getUsername, username).one();
        if (e == null) {
            // 安全:统一返"用户名或密码错误",不暴露用户是否存在
            return Result.fail(ErrorCode.UNAUTHORIZED.getCode(), "用户名或密码错误");
        }
        if (e.getStatus() == null || e.getStatus() != 1) {
            return Result.fail(ErrorCode.FORBIDDEN.getCode(), "账号已禁用");
        }

        // 3) BCrypt 校验(防 IllegalArgumentException 冒泡 500)
        try {
            if (!org.springframework.security.crypto.bcrypt.BCrypt.checkpw(password, e.getPassword())) {
                return Result.fail(ErrorCode.UNAUTHORIZED.getCode(), "用户名或密码错误");
            }
        } catch (IllegalArgumentException ex) {
            log.error("[Auth] 密码 hash 格式错误, userId={}", e.getId(), ex);
            return Result.fail(ErrorCode.UNAUTHORIZED.getCode(), "用户名或密码错误");
        }

        // 4) 签 JWT(失败应 catch,不冒泡 500)
        String token;
        try {
            token = jwtUtil.generate(e.getId(), "admin_" + e.getId(), e.getRole(), true);
        } catch (Exception ex) {
            log.error("[Auth] JWT 签发失败, userId={}", e.getId(), ex);
            return Result.fail(ErrorCode.FAIL.getCode(), "登录失败,请稍后重试");
        }

        // 5) 更新最后登录时间(失败只 log,不影响登录)
        try {
            e.setLastLoginTime(java.time.LocalDateTime.now());
            employeeService.updateById(e);
        } catch (Exception ex) {
            log.warn("[Auth] 更新最后登录时间失败, userId={}", e.getId(), ex);
            // 继续:不影响登录成功
        }

        Map<String, Object> data = new HashMap<>();
        data.put("token", token);
        data.put("userId", e.getId());
        data.put("role", e.getRole());
        data.put("name", e.getName());
        return Result.ok(data);
    }

    /**
     * 登出
     */
    @PostMapping("/logout")
    @Operation(summary = "登出")
    public Result<Map<String, Object>> logout() {
        // 简化: 前端清 token 即可
        return Result.ok(new HashMap<>());
    }

}
