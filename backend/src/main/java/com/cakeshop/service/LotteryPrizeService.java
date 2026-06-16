package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.entity.LotteryPrize;
import com.cakeshop.repository.LotteryPrizeRepository;
import org.springframework.stereotype.Service;

@Service
public class LotteryPrizeService extends ServiceImpl<LotteryPrizeRepository, LotteryPrize> {
}
