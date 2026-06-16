package com.cakeshop.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cakeshop.entity.Favorite;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface FavoriteRepository extends BaseMapper<Favorite> {
}
