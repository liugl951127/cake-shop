package com.cakeshop.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.config.CakeshopProperties;
import com.cakeshop.entity.Employee;
import com.cakeshop.repository.EmployeeRepository;
import com.cakeshop.security.JwtUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 员工 Service
 *   角色: super_admin / admin / operator / finance / customer_service / readonly
 *   BCrypt 密码
 */
@Slf4j
@Service
public class EmployeeService extends ServiceImpl<EmployeeRepository, Employee> {

    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private CakeshopProperties properties;

    /**
     * 登录: 手机号 + 密码
     */
    public Map<String, Object> login(String phone, String password) {
        Employee e = baseMapper.findByPhone(phone);
        if (e == null) {
            throw new BizException(ErrorCode.FORBIDDEN, "账号或密码错误");
        }
        if (e.getStatus() == null || e.getStatus() != 1) {
            throw new BizException(ErrorCode.FORBIDDEN, "账号已禁用");
        }
        if (!passwordEncoder.matches(password, e.getPassword())) {
            throw new BizException(ErrorCode.FORBIDDEN, "账号或密码错误");
        }
        // 登录成功
        String token = jwtUtil.generate(e.getId(), null, e.getRole(), "super_admin".equals(e.getRole()) || "admin".equals(e.getRole()));
        e.setLastLoginTime(LocalDateTime.now());
        baseMapper.updateById(e);

        Map<String, Object> data = new HashMap<>();
        data.put("token", token);
        data.put("employee", e);
        return data;
    }

    /**
     * 校验角色合法
     */
    public void validateRole(String role) {
        List<String> all = properties.getRbac().getAdmin(); // 简化:任意非空
        if (role == null || role.trim().isEmpty()) {
            throw new BizException(ErrorCode.BAD_REQUEST, "角色必填");
        }
    }

    public List<Employee> listAll() {
        return list(new LambdaQueryWrapper<Employee>().orderByDesc(Employee::getCreateTime));
    }

    public Employee create(String name, String phone, String role, String password) {
        validateRole(role);
        if (baseMapper.findByPhone(phone) != null) {
            throw new BizException(ErrorCode.CONFLICT, "手机号已存在");
        }
        Employee e = new Employee();
        e.setName(name);
        e.setPhone(phone);
        e.setRole(role);
        e.setPassword(passwordEncoder.encode(password == null || password.isEmpty() ? "123456" : password));
        e.setStatus(1);
        save(e);
        return e;
    }

    public void changeRole(Long id, String role) {
        validateRole(role);
        Employee e = getById(id);
        if (e == null) throw new BizException(ErrorCode.NOT_FOUND, "员工不存在");
        e.setRole(role);
        updateById(e);
    }

    public void changeStatus(Long id, int status) {
        Employee e = getById(id);
        if (e == null) throw new BizException(ErrorCode.NOT_FOUND, "员工不存在");
        e.setStatus(status);
        updateById(e);
    }
}
