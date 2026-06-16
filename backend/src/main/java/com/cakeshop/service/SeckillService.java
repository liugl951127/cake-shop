package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.entity.Seckill;
import com.cakeshop.repository.SeckillRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class SeckillService extends ServiceImpl<SeckillRepository, Seckill> {

    public List<Seckill> listActive() {
        LocalDateTime now = LocalDateTime.now();
        return lambdaQuery().eq(Seckill::getStatus, 1)
            .le(Seckill::getStartTime, now).ge(Seckill::getEndTime, now)
            .orderByDesc(Seckill::getCreateTime).list();
    }

    public List<Seckill> listAll(int page, int size) {
        return lambdaQuery().orderByDesc(Seckill::getCreateTime)
            .last("LIMIT " + page * size + "," + size).list();
    }

    public Seckill get(Long id) {
        return getById(id);
    }
}
