package com.cakeshop.controller;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import com.cakeshop.entity.Goods;
import com.cakeshop.repository.GoodsRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 商家后台 - 商品管理
 *   /list /batch /price /stock /onSale /offSale
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/goods")
@Tag(name = "管理后台 - 商品")
public class AdminGoodsController {

    @Autowired private GoodsRepository goodsRepo;

    @GetMapping("/list")
    @Operation(summary = "商品列表")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    public Result<Map<String, Object>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) Integer status
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("page", page);
        data.put("size", size);
        data.put("total", 0);
        data.put("list", List.of());
        // TODO: 接 GoodsService
        return Result.ok(data);
    }

    @PostMapping("/batch")
    @Operation(summary = "批量操作: 上下架/调价/调库存/改分类")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public Result<Map<String, Object>> batch(@RequestBody Map<String, Object> req) {
        String action = (String) req.get("action");
        @SuppressWarnings("unchecked")
        List<String> ids = (List<String>) req.get("ids");
        Map<String, Object> payload = (Map<String, Object>) req.get("payload");
        if (action == null) throw new BizException(ErrorCode.BAD_REQUEST, "action 必填");
        if (ids == null || ids.isEmpty()) throw new BizException(ErrorCode.BAD_REQUEST, "ids 必填");

        // TODO: 走 GoodsService 调
        Map<String, Object> data = new HashMap<>();
        data.put("affected", ids.size());
        data.put("action", action);
        return Result.ok(data);
    }

    @PutMapping("/{id}/price")
    @Operation(summary = "调整价格")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public Result<Void> updatePrice(@PathVariable String id, @RequestBody Map<String, Object> body) {
        if (body.get("price") == null) throw new BizException(ErrorCode.BAD_REQUEST, "price 必填");
        // TODO: GoodsService.updatePrice
        return Result.ok();
    }

    @PutMapping("/{id}/stock")
    @Operation(summary = "调整库存")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    public Result<Void> updateStock(@PathVariable String id, @RequestBody Map<String, Object> body) {
        if (body.get("stock") == null) throw new BizException(ErrorCode.BAD_REQUEST, "stock 必填");
        // TODO: GoodsService.updateStock
        return Result.ok();
    }

    @PostMapping("/{id}/on-sale")
    @Operation(summary = "上架")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    public Result<Void> onSale(@PathVariable String id) {
        // TODO
        return Result.ok();
    }

    @PostMapping("/{id}/off-sale")
    @Operation(summary = "下架")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    public Result<Void> offSale(@PathVariable String id) {
        // TODO
        return Result.ok();
    }
}
