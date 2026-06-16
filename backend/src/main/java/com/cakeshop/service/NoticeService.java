package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.entity.Notice;
import com.cakeshop.repository.NoticeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class NoticeService extends ServiceImpl<NoticeRepository, Notice> {

    public List<Notice> list(String category, Integer limit) {
        int lim = (limit == null || limit < 1) ? 20 : Math.min(limit, 100);
        return lambdaQuery().eq(Notice::getStatus, 1)
            .and(category != null && !category.isEmpty(), w -> w.eq(Notice::getCategory, category))
            .orderByDesc(Notice::getTop)
            .orderByDesc(Notice::getCreateTime)
            .last("LIMIT " + lim).list();
    }

    public Notice get(Long id) {
        Notice n = getById(id);
        if (n != null) {
            n.setViewCount((n.getViewCount() == null ? 0 : n.getViewCount()) + 1);
            updateById(n);
        }
        return n;
    }
}
