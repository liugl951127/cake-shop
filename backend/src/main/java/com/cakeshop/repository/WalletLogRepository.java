package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.WalletLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WalletLogRepository extends BaseMapper<WalletLog> {
}
