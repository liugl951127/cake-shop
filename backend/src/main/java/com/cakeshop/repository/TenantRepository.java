package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.Tenant;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TenantRepository extends BaseMapper<Tenant> {
    @Select("SELECT * FROM tenant WHERE code = #{code} AND deleted = 0 LIMIT 1")
    Tenant findByCode(String code);
}
