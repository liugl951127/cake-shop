package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.ErrorReport;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ErrorReportRepository extends BaseMapper<ErrorReport> {
}
