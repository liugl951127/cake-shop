package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.entity.GroupBuy;
import com.cakeshop.repository.GroupBuyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class GroupBuyService extends ServiceImpl<GroupBuyRepository, GroupBuy> {

    public List<GroupBuy> listActive() {
        LocalDateTime now = LocalDateTime.now();
        return lambdaQuery().eq(GroupBuy::getStatus, 1)
            .le(GroupBuy::getStartTime, now).ge(GroupBuy::getEndTime, now)
            .orderByDesc(GroupBuy::getCreateTime).list();
    }

    public GroupBuy get(Long id) { return getById(id); }
}
