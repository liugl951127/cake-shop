package com.cakeshop.controller;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import com.cakeshop.entity.Employee;
import com.cakeshop.service.EmployeeService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/employees")
@Api(tags = "员工管理(RBAC)")
public class EmployeeController {

    @Autowired private EmployeeService employeeService;

    @GetMapping
    @ApiOperation("员工列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<List<Employee>> list() {
        return Result.ok(employeeService.listAll());
    }

    @PostMapping
    @ApiOperation("新增员工")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Employee> create(@RequestBody Map<String, String> body) {
        return Result.ok(employeeService.create(
            body.get("name"), body.get("phone"), body.get("role"),
            body.getOrDefault("password", "123456")));
    }

    @PostMapping("/{id}/role")
    @ApiOperation("修改角色")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<Void> changeRole(@PathVariable Long id, @RequestBody Map<String, String> body) {
        employeeService.changeRole(id, body.get("role"));
        return Result.ok();
    }

    @PostMapping("/{id}/status")
    @ApiOperation("启用/禁用")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public Result<Void> changeStatus(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        Integer status = body.get("status");
        if (status == null) throw new BizException(ErrorCode.BAD_REQUEST, "status 必填");
        employeeService.changeStatus(id, status);
        return Result.ok();
    }
}
