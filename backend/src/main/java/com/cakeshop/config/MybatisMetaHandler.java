package com.cakeshop.config;

import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import com.cakeshop.security.LoginUser;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * MyBatis-Plus 自动填充:
 *   插入时: createTime / updateTime / createBy
 *   更新时: updateTime / updateBy
 *   从 SecurityContext 取当前用户
 */
@Component
public class MybatisMetaHandler implements MetaObjectHandler {

    @Override
    public void insertFill(MetaObject metaObject) {
        this.strictInsertFill(metaObject, "createTime", LocalDateTime.class, LocalDateTime.now());
        this.strictInsertFill(metaObject, "updateTime", LocalDateTime.class, LocalDateTime.now());
        this.strictInsertFill(metaObject, "createBy", String.class, currentUser());
        this.strictInsertFill(metaObject, "updateBy", String.class, currentUser());
    }

    @Override
    public void updateFill(MetaObject metaObject) {
        this.strictUpdateFill(metaObject, "updateTime", LocalDateTime.class, LocalDateTime.now());
        this.strictUpdateFill(metaObject, "updateBy", String.class, currentUser());
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return "system";
        Object p = auth.getPrincipal();
        if (p instanceof LoginUser) {
            LoginUser u = (LoginUser) p;
            return u.getOpenid() != null ? u.getOpenid() : String.valueOf(u.getUserId());
        }
        return "system";
    }
}
