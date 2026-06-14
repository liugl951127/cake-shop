package com.cakeshop.security;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.io.Serializable;

/**
 * 登录用户上下文(从 JWT 解析)
 */
@Data
@AllArgsConstructor
public class LoginUser implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long userId;
    private String openid;
    private String role;
    private boolean isAdmin;
}
