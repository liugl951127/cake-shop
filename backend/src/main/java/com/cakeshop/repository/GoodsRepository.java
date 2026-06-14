package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.Goods;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface GoodsRepository extends BaseMapper<Goods> {

    @Update("UPDATE goods SET stock = stock - #{delta}, sales = sales + #{delta} " +
            "WHERE id = #{id} AND stock >= #{delta} AND deleted = 0")
    int decStock(Long id, Integer delta);

    @Select("SELECT IFNULL(SUM(stock), 0) FROM goods WHERE status = 1 AND deleted = 0")
    Long totalStock();
}
