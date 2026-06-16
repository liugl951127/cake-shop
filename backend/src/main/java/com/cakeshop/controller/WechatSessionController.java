package com.cakeshop.controller;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.R;
import com.cakeshop.security.MiniProgramSessionService;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * 微信小程序 session 端点(替代云函数 login)
 *
 * POST /api/wx/session
 *   body: { code, inviterCode? }
 *   res:  { code: 0, data: { openid, token, userId, isNew } }
 *
 * POST /api/wx/session/logout
 *   头: X-Openid
 *   清除 session token
 */
@Slf4j
@RestController
@RequestMapping("/api/wx")
public class WechatSessionController {

    @Autowired
    private MiniProgramSessionService sessionService;

    @PostMapping("/session")
    public R<MiniProgramSessionService.SessionResult> code2Session(@RequestBody CodeReq req) {
        if (req == null || !org.springframework.util.StringUtils.hasText(req.getCode())) {
            throw new BizException(ErrorCode.BAD_REQUEST, "code 不能为空");
        }
        MiniProgramSessionService.SessionResult r = sessionService.code2Session(req.getCode(), req.getInviterCode());
        return R.ok(r);
    }

    @PostMapping("/session/logout")
    public R<Void> logout(@RequestHeader(value = "X-Openid", required = false) String openid) {
        if (org.springframework.util.StringUtils.hasText(openid)) {
            sessionService.logout(openid);
        }
        return R.ok();
    }

    @Data
    public static class CodeReq {
        private String code;
        private String inviterCode;
    }
}
