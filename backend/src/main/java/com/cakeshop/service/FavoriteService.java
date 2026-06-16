package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.entity.Favorite;
import com.cakeshop.repository.FavoriteRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class FavoriteService extends ServiceImpl<FavoriteRepository, Favorite> {

    public boolean toggle(Long userId, Long goodsId) {
        Favorite f = lambdaQuery().eq(Favorite::getUserId, userId)
            .eq(Favorite::getGoodsId, goodsId).one();
        if (f != null) { removeById(f.getId()); return false; }
        Favorite n = new Favorite();
        n.setUserId(userId); n.setGoodsId(goodsId);
        save(n);
        return true;
    }

    public boolean isFavored(Long userId, Long goodsId) {
        if (userId == null || goodsId == null) return false;
        return lambdaQuery().eq(Favorite::getUserId, userId)
            .eq(Favorite::getGoodsId, goodsId).count() > 0;
    }

    public List<Favorite> listByUser(Long userId) {
        return lambdaQuery().eq(Favorite::getUserId, userId)
            .orderByDesc(Favorite::getCreateTime).list();
    }
}
