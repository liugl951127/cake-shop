package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.Address;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AddressRepository extends BaseMapper<Address> {
}
