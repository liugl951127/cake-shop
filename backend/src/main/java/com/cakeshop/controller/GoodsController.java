package com.cakeshop.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cakeshop.common.Result;
import com.cakeshop.entity.Goods;
import com.cakeshop.service.GoodsService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/goods")
@Tag(name = "商品管理")
public class GoodsController {

    @Autowired private GoodsService goodsService;

    @GetMapping
    @Operation(summary = "商品分页")
    public Result<Page<Goods>> page(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) Integer status,
        @RequestParam(required = false) String keyword
    ) {
        LambdaQueryWrapper<Goods> w = new LambdaQueryWrapper<Goods>().orderByDesc(Goods::getCreateTime);
        if (status != null) w.eq(Goods::getStatus, status);
        if (keyword != null && !keyword.isEmpty()) w.like(Goods::getName, keyword);
        return Result.ok(goodsService.page(new Page<>(page, size), w));
    }

    @GetMapping("/{id}")
    @Operation(summary = "商品详情")
    public Result<Goods> get(@PathVariable Long id) {
        return Result.ok(goodsService.getOrThrow(id));
    }

    @PostMapping
    @Operation(summary = "创建商品")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR')")
    public Result<Goods> create(@RequestBody Goods g) {
        if (g.getStock() == null) g.setStock(0);
        if (g.getSales() == null) g.setSales(0);
        if (g.getStatus() == null) g.setStatus(0);
        if (g.getPrice() == null) g.setPrice(BigDecimal.ZERO);
        if (g.getSort() == null) g.setSort(0);
        goodsService.save(g);
        return Result.ok(g);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新商品")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR')")
    public Result<Goods> update(@PathVariable Long id, @RequestBody Goods g) {
        g.setId(id);
        goodsService.updateById(g);
        return Result.ok(g);
    }

    @PostMapping("/{id}/onSale")
    @Operation(summary = "上架")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR')")
    public Result<Void> onSale(@PathVariable Long id) {
        Goods g = new Goods();
        g.setId(id);
        g.setStatus(1);
        goodsService.updateById(g);
        return Result.ok();
    }

    @PostMapping("/{id}/offSale")
    @Operation(summary = "下架")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR')")
    public Result<Void> offSale(@PathVariable Long id) {
        Goods g = new Goods();
        g.setId(id);
        g.setStatus(0);
        goodsService.updateById(g);
        return Result.ok();
    }

    @PostMapping("/{id}/stock/adjust")
    @Operation(summary = "调库存")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR')")
    public Result<Void> adjustStock(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        Integer delta = body.get("delta");
        if (delta == null || delta == 0) return Result.ok();
        if (delta < 0) {
            boolean ok = goodsService.tryDecStock(id, -delta);
            if (!ok) return Result.fail(com.cakeshop.common.ErrorCode.OUT_OF_STOCK);
        } else {
            goodsService.incStock(id, delta);
        }
        return Result.ok();
    }
}
