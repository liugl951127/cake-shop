package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.entity.Cart;
import com.cakeshop.repository.CartRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class CartService extends ServiceImpl<CartRepository, Cart> {

    public List<Cart> listByUser(Long userId) {
        return lambdaQuery().eq(Cart::getUserId, userId)
            .orderByDesc(Cart::getCreateTime).list();
    }

    public Cart add(Long userId, Long goodsId, String spec, Integer count) {
        if (count == null || count <= 0) count = 1;
        if (spec == null) spec = "";
        Cart exist = lambdaQuery()
            .eq(Cart::getUserId, userId)
            .eq(Cart::getGoodsId, goodsId)
            .eq(Cart::getSpec, spec).one();
        if (exist != null) {
            exist.setCount(exist.getCount() + count);
            updateById(exist);
            return exist;
        }
        Cart c = new Cart();
        c.setUserId(userId);
        c.setGoodsId(goodsId);
        c.setSpec(spec);
        c.setCount(count);
        c.setSelected(1);
        save(c);
        return c;
    }

    public void setCount(Long id, Integer count) {
        if (count == null || count <= 0) { removeById(id); return; }
        Cart c = getById(id);
        if (c != null) { c.setCount(count); updateById(c); }
    }

    public void clearSelected(Long userId) {
        lambdaUpdate().eq(Cart::getUserId, userId)
            .eq(Cart::getSelected, 1).remove();
    }
}
