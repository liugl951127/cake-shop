package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.entity.CmsPage;
import com.cakeshop.repository.CmsPageRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class CmsService extends ServiceImpl<CmsPageRepository, CmsPage> {

    public CmsPage getByKey(String key) {
        if (key == null) return null;
        return lambdaQuery().eq(CmsPage::getKey, key)
            .eq(CmsPage::getStatus, 1).one();
    }
}
