package com.cakeshop.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.entity.Goods;
import com.cakeshop.repository.GoodsRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 商品 Service
 *   库存原子扣减(走 SQL,避免并发超卖)
 */
@Slf4j
@Service
public class GoodsService extends ServiceImpl<GoodsRepository, Goods> {

    public List<Goods> listOnSale(Long shopId) {
        LambdaQueryWrapper<Goods> w = new LambdaQueryWrapper<Goods>()
            .eq(Goods::getStatus, 1)
            .orderByDesc(Goods::getSort)
            .orderByDesc(Goods::getCreateTime);
        if (shopId != null) w.eq(Goods::getShopId, shopId);
        return list(w);
    }

    public Goods getOrThrow(Long id) {
        Goods g = getById(id);
        if (g == null || g.getStatus() != 1) {
            throw new BizException(ErrorCode.NOT_FOUND, "商品不存在或已下架");
        }
        return g;
    }

    /**
     * 原子扣库存(走 SQL 条件:stock >= delta)
     * 失败 = 0 行
     */
    public boolean tryDecStock(Long goodsId, int delta) {
        if (delta <= 0) return true;
        int rows = baseMapper.decStock(goodsId, delta);
        if (rows == 0) {
            log.warn("库存不足: goodsId={}, delta={}", goodsId, delta);
            return false;
        }
        return true;
    }

    /**
     * 恢复库存(取消订单)
     */
    public void incStock(Long goodsId, int delta) {
        if (delta <= 0) return;
        Goods g = getById(goodsId);
        if (g == null) return;
        g.setStock((g.getStock() == null ? 0 : g.getStock()) + delta);
        updateById(g);
    }
}
