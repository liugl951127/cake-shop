package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.Notice;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface NoticeRepository extends BaseMapper<Notice> {
}
