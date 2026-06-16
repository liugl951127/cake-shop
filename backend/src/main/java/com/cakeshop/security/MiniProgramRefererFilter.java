package com.cakeshop.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * 微信小程序来源校验(防外网直接打后端)
 *
 * 微信小程序请求的 Referer 头是:
 *   https://servicewechat.com/{APPID}/{VERSION}/page-frame.html
 *
 * 必须匹配, 否则拒绝:
 *   403 Forbidden
 *
 * 例外:
 *   1. 开发环境 (cakeshop.mp-referer.enabled=false)
 *   2. OPTIONS 预检
 *   3. 内部 RPC (X-Internal-Token)
 *   4. 公开接口 (/auth/login, /api/wx/session)
 *
 * 注意: devtools / 真机调试 时 Referer 略有不同, 开发期关掉
 */
@Slf4j
@Component
@Order(2)  // 在 InternalRpcFilter 之后
public class MiniProgramRefererFilter extends OncePerRequestFilter {

    @Value("${cakeshop.mp-referer.enabled:false}")
    private boolean enabled;

    @Value("${cakeshop.mp-referer.appid:}")
    private String appid;

    private static final String REFERER_PREFIX = "https://servicewechat.com/";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (!enabled) {
            chain.doFilter(req, res);
            return;
        }

        // OPTIONS 放行(CORS 预检)
        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
            chain.doFilter(req, res);
            return;
        }

        // 内部 RPC 放行(已通过 InternalRpcFilter 鉴权)
        String internalToken = req.getHeader("X-Internal-Token");
        if (internalToken != null && !internalToken.isEmpty()) {
            chain.doFilter(req, res);
            return;
        }

        // 公开接口放行
        String uri = req.getRequestURI();
        if (uri != null && (
            uri.startsWith("/api/auth/") ||
            uri.startsWith("/api/wx/") ||
            uri.startsWith("/api/internal/")
        )) {
            chain.doFilter(req, res);
            return;
        }

        String referer = req.getHeader("Referer");
        if (referer == null || !referer.startsWith(REFERER_PREFIX)) {
            log.warn("MP Referer check fail: {} {} from {} referer={}", req.getMethod(), uri, req.getRemoteAddr(), referer);
            res.setStatus(HttpServletResponse.SC_FORBIDDEN);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"code\":403,\"msg\":\"invalid referer\"}");
            return;
        }

        // 校验 appid (如配置)
        if (appid != null && !appid.isEmpty()) {
            // 期望格式: https://servicewechat.com/{APPID}/{version}/page-frame.html
            String expected = REFERER_PREFIX + appid + "/";
            if (!referer.startsWith(expected)) {
                log.warn("MP Referer appid mismatch: {} vs {}", referer, expected);
                res.setStatus(HttpServletResponse.SC_FORBIDDEN);
                res.setContentType("application/json;charset=UTF-8");
                res.getWriter().write("{\"code\":403,\"msg\":\"appid mismatch\"}");
                return;
            }
        }

        chain.doFilter(req, res);
    }
}
