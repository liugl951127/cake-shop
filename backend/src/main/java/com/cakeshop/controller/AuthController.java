package com.cakeshop.controller;

import com.cakeshop.common.Result;
import com.cakeshop.service.EmployeeService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/auth")
@Tag(name = "鉴权")
public class AuthController {

    @Autowired private EmployeeService employeeService;

    @PostMapping("/login")
    @Operation(summary = "员工登录")
    public Result<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String password = body.get("password");
        if (phone == null || password == null) {
            return Result.fail(com.cakeshop.common.ErrorCode.BAD_REQUEST.getCode(), "手机号/密码必填");
        }
        return Result.ok(employeeService.login(phone, password));
    }

    @PostMapping("/logout")
    @Operation(summary = "登出(无状态,前端清掉 token 即可)")
    public Result<Void> logout() {
        return Result.ok();
    }
}
