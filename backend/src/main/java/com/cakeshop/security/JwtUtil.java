package com.cakeshop.security;

import com.cakeshop.config.CakeshopProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * JWT 工具
 *   HMAC-SHA256 签名
 *   默认 7 天过期
 *   payload: { _id, openid, role, isAdmin }
 */
@Component
public class JwtUtil {

    private final CakeshopProperties properties;
    private final SecretKey key;

    public JwtUtil(CakeshopProperties properties) {
        this.properties = properties;
        // 32 字节以上密钥
        byte[] bytes = properties.getSecurity().getJwtSecret().getBytes(StandardCharsets.UTF_8);
        this.key = Keys.hmacShaKeyFor(padTo32(bytes));
    }

    private byte[] padTo32(byte[] src) {
        if (src.length >= 32) return src;
        byte[] dst = new byte[32];
        System.arraycopy(src, 0, dst, 0, src.length);
        return dst;
    }

    public String generate(Long userId, String openid, String role, boolean isAdmin) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("_id", userId);
        claims.put("openid", openid);
        claims.put("role", role);
        claims.put("isAdmin", isAdmin);
        long now = System.currentTimeMillis();
        return Jwts.builder()
            .setClaims(claims)
            .setIssuedAt(new Date(now))
            .setExpiration(new Date(now + properties.getSecurity().getJwtTtl()))
            .signWith(key, SignatureAlgorithm.HS256)
            .compact();
    }

    public Claims parse(String token) {
        try {
            return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
        } catch (Exception e) {
            return null;
        }
    }

    public boolean isExpired(String token) {
        Claims c = parse(token);
        return c == null || c.getExpiration().before(new Date());
    }
}
