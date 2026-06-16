package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 员工/管理员
 *   role: super_admin / admin / operator / finance / customer_service / readonly
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("employee")
public class Employee extends BaseEntity {

    private String name;
    private String username;    // 登录用户名
    private String phone;
    private String role;
    private String password;        // BCrypt 哈希
    private Integer status;         // 1-正常 0-禁用
    private LocalDateTime lastLoginTime;
}
