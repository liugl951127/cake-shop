package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.RiskLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface RiskLogRepository extends BaseMapper<RiskLog> {
}
