package com.cakeshop.security;

import lombok.extern.slf4j.Slf4j;
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
 * 内部 RPC Token 鉴权(给云函数 / 内部服务调用, 不给小程序)
 *
 * 用法:
 *   curl -H "X-Internal-Token: ${INTERNAL_RPC_TOKEN}" http://api/api/admin/dashboard
 *
 * 安全:
 *   - token 由环境变量注入, 不写代码
 *   - 只能访问 /api/internal/** 路径
 *   - 比 JWT 轻量, 不需要 user 信息
 *
 * 为什么需要:
 *   - 后端某些接口(如 admin 内部统计) 不想暴露给小程序
 *   - 云函数 → 后端的中转调用需要内网认证
 *   - 跨服务(微服务) 内部调用
 */
@Slf4j
@Component
@Order(0)  // 最高优先级, 比 JwtAuthFilter / MiniProgramAuthFilter 更早
public class InternalRpcFilter extends OncePerRequestFilter {

    @Value("${cakeshop.internal-rpc.token:}")
    private String configuredToken;

    @Value("${cakeshop.internal-rpc.path-prefix:/api/internal/}")
    private String pathPrefix;

    @Value("${cakeshop.internal-rpc.enabled:true}")
    private boolean enabled;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (!enabled || !StringUtils.hasText(configuredToken)) {
            chain.doFilter(req, res);
            return;
        }

        String uri = req.getRequestURI();
        // 只对 /api/internal/** 生效
        if (uri == null || !uri.startsWith(pathPrefix)) {
            chain.doFilter(req, res);
            return;
        }

        String token = req.getHeader("X-Internal-Token");
        if (!StringUtils.hasText(token) || !constantTimeEquals(token, configuredToken)) {
            log.warn("Internal RPC: invalid token from {} {}", req.getRemoteAddr(), uri);
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"code\":401,\"msg\":\"internal rpc token invalid\"}");
            return;
        }

        // 通过: 注入 SUPER 权限
        Collection<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_INTERNAL"));
        authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
        LoginUser principal = new LoginUser(0L, "internal-rpc", "internal", true);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
            principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);

        if (log.isDebugEnabled()) {
            log.debug("Internal RPC OK: {} {} from {}", req.getMethod(), uri, req.getRemoteAddr());
        }
        chain.doFilter(req, res);
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) return false;
        int r = 0;
        for (int i = 0; i < a.length(); i++) r |= a.charAt(i) ^ b.charAt(i);
        return r == 0;
    }
}
