package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.Withdraw;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WithdrawRepository extends BaseMapper<Withdraw> {
}
