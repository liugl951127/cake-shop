package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.entity.LotteryPrize;
import com.cakeshop.entity.LotteryRecord;
import com.cakeshop.repository.LotteryRecordRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

@Slf4j
@Service
public class LotteryService extends ServiceImpl<LotteryRecordRepository, LotteryRecord> {

    @Autowired private LotteryPrizeService prizeService;

    public List<LotteryPrize> listActivePrizes() {
        return prizeService.lambdaQuery()
            .eq(LotteryPrize::getStatus, 1)
            .gt(LotteryPrize::getStock, 0)
            .orderByDesc(LotteryPrize::getCreateTime).list();
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> draw(Long userId) {
        if (userId == null) throw new BizException(ErrorCode.BAD_REQUEST, "userId 必填");
        List<LotteryPrize> prizes = listActivePrizes();
        if (prizes.isEmpty()) throw new BizException(ErrorCode.NOT_FOUND, "暂无可抽奖品");
        int totalWeight = prizes.stream().mapToInt(p -> p.getWeight() == null ? 0 : p.getWeight()).sum();
        if (totalWeight <= 0) throw new BizException(ErrorCode.FAIL, "奖品权重配置错误");
        int r = new Random().nextInt(totalWeight);
        LotteryPrize hit = prizes.get(0);
        int cur = 0;
        for (LotteryPrize p : prizes) {
            cur += (p.getWeight() == null ? 0 : p.getWeight());
            if (r < cur) { hit = p; break; }
        }
        hit.setStock((hit.getStock() == null ? 0 : hit.getStock()) - 1);
        prizeService.updateById(hit);

        LotteryRecord rec = new LotteryRecord();
        rec.setUserId(userId);
        rec.setPrizeId(hit.getId());
        rec.setPrizeName(hit.getName());
        rec.setPrizeType(hit.getType());
        rec.setStatus(0);
        rec.setCreateTime(LocalDateTime.now());
        save(rec);

        Map<String, Object> data = new HashMap<>();
        data.put("record", rec);
        data.put("prize", hit);
        return data;
    }

    public List<LotteryRecord> myRecords(Long userId) {
        return lambdaQuery().eq(LotteryRecord::getUserId, userId)
            .orderByDesc(LotteryRecord::getCreateTime)
            .last("LIMIT 50").list();
    }
}
