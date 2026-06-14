package com.cakeshop.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cakeshop.common.Result;
import com.cakeshop.entity.ErrorReport;
import com.cakeshop.entity.PerformanceMetric;
import com.cakeshop.repository.ErrorReportRepository;
import com.cakeshop.repository.PerformanceMetricRepository;
import com.cakeshop.security.TenantContext;
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
@RequestMapping("/monitor")
@Tag(name = "监控中心")
public class MonitorController {

    @Autowired private PerformanceMetricRepository metricRepository;
    @Autowired private ErrorReportRepository errorRepository;

    @GetMapping("/perf")
    @Operation(summary = "性能指标查询")
    public Result<Page<PerformanceMetric>> perf(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String name,
        @RequestParam(required = false) Long startTs,
        @RequestParam(required = false) Long endTs
    ) {
        LambdaQueryWrapper<PerformanceMetric> w = new LambdaQueryWrapper<PerformanceMetric>()
            .orderByDesc(PerformanceMetric::getTs);
        if (name != null) w.eq(PerformanceMetric::getName, name);
        if (startTs != null) w.ge(PerformanceMetric::getTs, startTs);
        if (endTs != null) w.le(PerformanceMetric::getTs, endTs);
        return Result.ok(metricRepository.selectPage(new Page<>(page, size), w));
    }

    @GetMapping("/perf/aggregate")
    @Operation(summary = "性能指标聚合")
    public Result<List<Map<String, Object>>> perfAggregate(
        @RequestParam(required = false) Long startTs,
        @RequestParam(required = false) Long endTs
    ) {
        long end = endTs == null ? System.currentTimeMillis() : endTs;
        long start = startTs == null ? (end - 24 * 60 * 60 * 1000) : startTs;
        return Result.ok(metricRepository.aggregateByName(
            TenantContext.getCurrent(), start, end));
    }

    @GetMapping("/errors")
    @Operation(summary = "异常列表")
    public Result<Page<ErrorReport>> errors(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String level,
        @RequestParam(required = false) String scene,
        @RequestParam(required = false) Long startTs,
        @RequestParam(required = false) Long endTs
    ) {
        LambdaQueryWrapper<ErrorReport> w = new LambdaQueryWrapper<ErrorReport>()
            .orderByDesc(ErrorReport::getTs);
        if (level != null) w.eq(ErrorReport::getLevel, level);
        if (scene != null) w.like(ErrorReport::getScene, scene);
        if (startTs != null) w.ge(ErrorReport::getTs, startTs);
        if (endTs != null) w.le(ErrorReport::getTs, endTs);
        return Result.ok(errorRepository.selectPage(new Page<>(page, size), w));
    }

    @GetMapping("/dashboard")
    @Operation(summary = "监控大盘")
    public Result<Map<String, Object>> dashboard() {
        Map<String, Object> r = new HashMap<>();
        long dayAgo = System.currentTimeMillis() - 24 * 60 * 60 * 1000;
        r.put("metricCount24h", metricRepository.selectCount(
            new LambdaQueryWrapper<PerformanceMetric>().ge(PerformanceMetric::getTs, dayAgo)));
        r.put("errorCount24h", errorRepository.selectCount(
            new LambdaQueryWrapper<ErrorReport>().ge(ErrorReport::getTs, dayAgo)));
        r.put("criticalErrors", errorRepository.selectCount(
            new LambdaQueryWrapper<ErrorReport>().ge(ErrorReport::getTs, dayAgo).eq(ErrorReport::getLevel, "critical")));
        r.put("perfAggregate", metricRepository.aggregateByName(
            TenantContext.getCurrent(), dayAgo, System.currentTimeMillis()));
        return Result.ok(r);
    }
}
