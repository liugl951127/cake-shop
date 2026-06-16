package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.Employee;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface EmployeeRepository extends BaseMapper<Employee> {

    @Select("SELECT * FROM employee WHERE phone = #{phone} AND deleted = 0 LIMIT 1")
    Employee findByPhone(String phone);
}
