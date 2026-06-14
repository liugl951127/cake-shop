package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.Order;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Mapper
public interface OrderRepository extends BaseMapper<Order> {

    @Select("SELECT IFNULL(SUM(total_price), 0) AS revenue, COUNT(*) AS cnt " +
            "FROM orders WHERE status >= 1 AND create_time >= #{start}")
    Map<String, Object> revenueSince(LocalDateTime start);

    @Select("SELECT IFNULL(SUM(total_price), 0) FROM orders " +
            "WHERE status >= 1 AND pay_time BETWEEN #{start} AND #{end}")
    java.math.BigDecimal revenueBetween(LocalDateTime start, LocalDateTime end);

    @Select("SELECT * FROM orders WHERE user_id = #{userId} ORDER BY create_time DESC LIMIT 50")
    List<Order> findByUserRecent(Long userId);

    @Select("SELECT status, COUNT(*) AS cnt FROM orders WHERE create_time >= #{start} GROUP BY status")
    List<Map<String, Object>> statusDistribution(LocalDateTime start);
}
