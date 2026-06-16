package com.cakeshop.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cakeshop.audit.Audited;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import com.cakeshop.entity.Tenant;
import com.cakeshop.repository.TenantRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/tenants")
@Tag(name = "多租户管理")
public class TenantController {

    @Autowired private TenantRepository tenantRepository;

    @GetMapping
    @Operation(summary = "租户列表")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<List<Tenant>> list() {
        return Result.ok(tenantRepository.selectList(
            new LambdaQueryWrapper<Tenant>().orderByDesc(Tenant::getCreateTime)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "租户详情")
    public Result<Tenant> detail(@PathVariable Long id) {
        Tenant t = tenantRepository.selectById(id);
        if (t == null) return Result.fail(ErrorCode.NOT_FOUND);
        return Result.ok(t);
    }

    @PostMapping
    @Operation(summary = "创建租户")
    @Audited(action = "tenant.create", targetType = "tenant", targetArg = "code", severity = "warn")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<Tenant> create(@RequestBody Map<String, Object> body) {
        String code = (String) body.get("code");
        if (code == null) return Result.fail(ErrorCode.BAD_REQUEST.getCode(), "code 必填");
        if (tenantRepository.findByCode(code) != null) {
            return Result.fail(ErrorCode.CONFLICT.getCode(), "code 已存在");
        }
        Tenant t = new Tenant();
        t.setCode(code);
        t.setName((String) body.getOrDefault("name", code));
        t.setStatus((String) body.getOrDefault("status", "active"));
        t.setPlan((String) body.getOrDefault("plan", "free"));
        Object expireAt = body.get("expireAt");
        t.setExpireAt(expireAt == null ? System.currentTimeMillis() + 365L * 24 * 60 * 60 * 1000 :
            Long.parseLong(expireAt.toString()));
        t.setQuota((String) body.getOrDefault("quota", "{}"));
        t.setContact((String) body.getOrDefault("contact", "{}"));
        t.setRemark((String) body.getOrDefault("remark", ""));
        tenantRepository.insert(t);
        return Result.ok(t);
    }

    @PostMapping("/{id}/disable")
    @Operation(summary = "禁用租户")
    @Audited(action = "tenant.disable", targetType = "tenant", targetArg = "id", severity = "critical")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<Void> disable(@PathVariable Long id) {
        Tenant t = tenantRepository.selectById(id);
        if (t == null) return Result.fail(ErrorCode.NOT_FOUND);
        t.setStatus("disabled");
        tenantRepository.updateById(t);
        return Result.ok();
    }

    @PostMapping("/{id}/enable")
    @Operation(summary = "启用租户")
    @Audited(action = "tenant.enable", targetType = "tenant", targetArg = "id", severity = "warn")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<Void> enable(@PathVariable Long id) {
        Tenant t = tenantRepository.selectById(id);
        if (t == null) return Result.fail(ErrorCode.NOT_FOUND);
        t.setStatus("active");
        tenantRepository.updateById(t);
        return Result.ok();
    }

    @PutMapping("/{id}/quota")
    @Operation(summary = "更新额度")
    @Audited(action = "tenant.updateQuota", targetType = "tenant", targetArg = "id", severity = "warn")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<Void> updateQuota(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Tenant t = tenantRepository.selectById(id);
        if (t == null) return Result.fail(ErrorCode.NOT_FOUND);
        t.setQuota(body.getOrDefault("quota", "{}").toString());
        tenantRepository.updateById(t);
        return Result.ok();
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static Long lng(Object o) { return o == null ? null : Long.valueOf(o.toString()); }
    private static Integer integer(Object o) { return o == null ? null : Integer.valueOf(o.toString()); }

}
