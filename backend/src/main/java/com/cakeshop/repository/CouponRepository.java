package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.Coupon;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CouponRepository extends BaseMapper<Coupon> {
}
