package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.Member;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MemberRepository extends BaseMapper<Member> {
}
