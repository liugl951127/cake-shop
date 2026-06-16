package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.entity.Review;
import com.cakeshop.repository.ReviewRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class ReviewService extends ServiceImpl<ReviewRepository, Review> {

    public Review add(Review r) {
        if (r.getScore() == null || r.getScore() < 1 || r.getScore() > 5) {
            throw new BizException(ErrorCode.BAD_REQUEST, "评分 1-5");
        }
        if (r.getContent() == null || r.getContent().trim().isEmpty()) {
            throw new BizException(ErrorCode.BAD_REQUEST, "评价内容不能为空");
        }
        r.setStatus(1);
        save(r);
        return r;
    }

    public List<Review> listByGoods(Long goodsId, Integer page, Integer size) {
        if (page == null || page < 1) page = 1;
        if (size == null || size < 1) size = 10;
        return lambdaQuery().eq(Review::getGoodsId, goodsId)
            .eq(Review::getStatus, 1)
            .orderByDesc(Review::getCreateTime)
            .last("LIMIT " + (page - 1) * size + "," + size).list();
    }

    public Double avgScore(Long goodsId) {
        List<Review> rs = lambdaQuery().eq(Review::getGoodsId, goodsId)
            .eq(Review::getStatus, 1).list();
        if (rs.isEmpty()) return 5.0;
        return rs.stream().mapToInt(Review::getScore).average().orElse(5.0);
    }

    public Long countByGoods(Long goodsId) {
        return lambdaQuery().eq(Review::getGoodsId, goodsId)
            .eq(Review::getStatus, 1).count();
    }

    public void reply(Long id, String reply) {
        Review r = new Review();
        r.setId(id);
        r.setReply(reply);
        r.setReplyTime(LocalDateTime.now());
        updateById(r);
    }
}
