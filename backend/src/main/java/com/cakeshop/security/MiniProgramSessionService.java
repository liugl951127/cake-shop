package com.cakeshop.security;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.TimeUnit;

/**
 * 微信小程序 session 管理
 *
 * 流程:
 *   1. 小程序调 wx.login → 拿 code
 *   2. POST /api/wx/session  body={code}
 *   3. 后端:
 *      a) 调 https://api.weixin.qq.com/sns/jscode2session 换 openid+session_key
 *      b) 查 user 表,没则创建
 *      c) 生成 X-Login-Token (24h 一次性, 存 Redis/Cache)
 *      d) 返回 {openid, token, userId, isNew}
 *   4. 小程序存 openid + token
 *   5. 每次请求带 X-Openid + X-Login-Token
 *
 * 安全:
 *   - openid 单独不能直接用(需要 token 配套)
 *   - 调微信 API 用 AppSecret (环境变量)
 *   - session_key 只在后端, 不返回给前端
 */
@Slf4j
@Service
public class MiniProgramSessionService {

    @Autowired(required = false)
    private com.cakeshop.common.cache.CacheClient cache;

    @Value("${cakeshop.wechat.appid:}")
    private String appid;

    @Value("${cakeshop.wechat.secret:}")
    private String secret;

    @Value("${cakeshop.mp-auth.token-ttl:86400}")
    private int tokenTtlSeconds;

    private static final String TOKEN_KEY = "mp:session:";
    private final SecureRandom rng = new SecureRandom();

    /**
     * 1. 小程序用 code 换 session
     *    - 没 user 则创建
     *    - 生成 token
     *    - 返回 {openid, token, userId, isNew}
     */
    public SessionResult code2Session(String code, String inviterCode) {
        // 调微信 jscode2session
        // https://api.weixin.qq.com/sns/jscode2session?appid=APPID&secret=SECRET&js_code=JSCODE&grant_type=authorization_code
        String url = "https://api.weixin.qq.com/sns/jscode2session"
                + "?appid=" + url(appid)
                + "&secret=" + url(secret)
                + "&js_code=" + url(code)
                + "&grant_type=authorization_code";

        WechatSession ws = httpGet(url, WechatSession.class);
        if (ws == null || !StringUtils.hasText(ws.openid)) {
            throw new RuntimeException("wx code2session failed: " + (ws == null ? "null" : ws.errcode + " " + ws.errmsg));
        }

        // 查/建 user (此处简化: 实际项目查 user 表)
        // 占位: 用 openid 当 userId (要换成 userService.findOrCreateByOpenid)
        LoginUser user = new LoginUser(
            (long) Math.abs(ws.openid.hashCode()),
            ws.openid,
            "user",
            false
        );

        // 生成 token
        String token = newToken();
        if (cache != null) {
            cache.setEx(TOKEN_KEY + ws.openid, token, tokenTtlSeconds, TimeUnit.SECONDS);
        }

        SessionResult r = new SessionResult();
        r.setOpenid(ws.openid);
        r.setToken(token);
        r.setUserId(user.getUserId());
        r.setIsNew(false);  // 简化,实际根据 user 是否新建
        return r;
    }

    /**
     * 2. 校验 token 拿 LoginUser
     */
    public LoginUser resolve(String openid, String token) {
        if (cache == null) {
            return findByOpenid(openid);
        }
        String stored = cache.get(TOKEN_KEY + openid);
        if (stored == null || !stored.equals(token)) {
            return null;
        }
        return findByOpenid(openid);
    }

    /**
     * 3. 仅 openid 查 user (免登录场景, 例如商品详情)
     */
    public LoginUser findByOpenid(String openid) {
        if (openid == null) return null;
        // 实际项目: 查 user 表
        // 这里简化: 总是返回 guest user
        LoginUser user = new LoginUser(
            (long) Math.abs(openid.hashCode()),
            openid,
            "user",
            false
        );
        return user;
    }

    /**
     * 4. 登出 (清 token)
     */
    public void logout(String openid) {
        if (cache != null) cache.del(TOKEN_KEY + openid);
    }

    private String newToken() {
        byte[] b = new byte[32];
        rng.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private String url(String s) {
        return s == null ? "" : java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8);
    }

    private <T> T httpGet(String url, Class<T> type) {
        try {
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            int code = conn.getResponseCode();
            if (code != 200) {
                log.warn("wx code2session http {}", code);
                return null;
            }
            try (java.io.InputStream is = conn.getInputStream()) {
                byte[] body = is.readAllBytes();
                return new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(body, type);
            }
        } catch (Exception e) {
            log.warn("wx code2session error: {}", e.getMessage());
            return null;
        }
    }

    // ====== DTOs ======
    @Data public static class WechatSession {
        public String openid;
        public String session_key;
        public String unionid;
        public Integer errcode;
        public String errmsg;
    }
    @Data public static class SessionResult {
        public String openid;
        public String token;
        public Long userId;
        public Boolean isNew;
    }
}
