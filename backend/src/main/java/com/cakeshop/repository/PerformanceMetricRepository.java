package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.PerformanceMetric;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface PerformanceMetricRepository extends BaseMapper<PerformanceMetric> {

    @Select("SELECT name, COUNT(*) AS cnt, AVG(value) AS avg, MAX(value) AS max " +
            "FROM performance_metrics " +
            "WHERE tenant_id = #{tenantId} AND ts BETWEEN #{start} AND #{end} " +
            "GROUP BY name")
    List<Map<String, Object>> aggregateByName(String tenantId, Long start, Long end);
}
