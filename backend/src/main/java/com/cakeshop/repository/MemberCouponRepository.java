package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.MemberCoupon;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MemberCouponRepository extends BaseMapper<MemberCoupon> {
}
