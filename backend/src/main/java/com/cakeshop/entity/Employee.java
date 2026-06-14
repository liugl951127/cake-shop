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
@TableName("employees")
public class Employee extends BaseEntity {

    private String name;
    private String phone;
    private String role;
    private String password;        // BCrypt 哈希
    private String avatar;
    private Integer status;         // 1-正常 0-禁用
    private String lastLoginIp;
    private LocalDateTime lastLoginTime;
}
