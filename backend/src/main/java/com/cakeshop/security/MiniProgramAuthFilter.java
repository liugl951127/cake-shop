package com.cakeshop.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;

/**
 * 微信小程序直连鉴权(替代云函数中转)
 *
 * 工作流程:
 *   1. 小程序调 wx.login 拿 code
 *   2. 小程序用 code 换 openid + sessionKey(走 /api/wx/session)
 *   3. 小程序把 openid 放到请求头 X-Openid
 *   4. 后端用 openid 查 user 表 → 注 SecurityContext
 *   5. (可选)用 X-Login-Token 二次校验,防 openid 伪造
 *
 * 头定义:
 *   X-Openid: 微信 openid(必填)
 *   X-Login-Token: 后端签发的一次性 token(可选, 防 openid 泄露)
 *   X-Client-Version: 客户端版本
 *
 * 配合 WechatSessionController 用
 */
@Slf4j
@Component
@Order(1)  // 在 JwtAuthFilter 之前
public class MiniProgramAuthFilter extends OncePerRequestFilter {

    @Autowired(required = false)
    private MiniProgramSessionService sessionService;

    @Value("${cakeshop.mp-auth.enabled:true}")
    private boolean enabled;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (!enabled) {
            chain.doFilter(req, res);
            return;
        }

        String openid = req.getHeader("X-Openid");
        String loginToken = req.getHeader("X-Login-Token");

        if (!StringUtils.hasText(openid)) {
            // 没 X-Openid - 可能是后台管理 / 公开接口, 放行让后续 JwtAuthFilter 处理
            chain.doFilter(req, res);
            return;
        }

        try {
            LoginUser user = null;
            if (sessionService != null && StringUtils.hasText(loginToken)) {
                // 有 token: 校验后查 user
                user = sessionService.resolve(openid, loginToken);
            } else {
                // 只用 openid 查(开发期或免登录接口)
                user = sessionService != null ? sessionService.findByOpenid(openid) : null;
            }

            if (user != null) {
                Collection<SimpleGrantedAuthority> authorities = new ArrayList<>();
                authorities.add(new SimpleGrantedAuthority("ROLE_" + (user.getRole() == null ? "USER" : user.getRole().toUpperCase())));
                if (user.isAdmin()) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
                }
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    user, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);
                if (log.isDebugEnabled()) log.debug("MP auth OK: openid={}, userId={}", openid, user.getUserId());
            } else {
                if (log.isDebugEnabled()) log.debug("MP auth: openid not found: {}", openid);
            }
        } catch (Exception e) {
            log.warn("MP auth error: {}", e.getMessage());
        }

        chain.doFilter(req, res);
    }
}
