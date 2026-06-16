package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.LotteryRecord;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface LotteryRecordRepository extends BaseMapper<LotteryRecord> {
}
