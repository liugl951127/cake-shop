package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.Review;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ReviewRepository extends BaseMapper<Review> {
}
