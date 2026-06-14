package com.cakeshop.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.entity.Order;
import com.cakeshop.repository.OrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 订单 Service
 *   状态机: 0->1->2->3->4 / -1 / -2 / -3
 *   关键: 库存原子扣减、订单退款、发货
 */
@Slf4j
@Service
public class OrderService extends ServiceImpl<OrderRepository, Order> {

    @Autowired private GoodsService goodsService;

    public IPage<Order> pageOrders(int page, int size, Integer status, Long userId) {
        LambdaQueryWrapper<Order> w = new LambdaQueryWrapper<Order>()
            .orderByDesc(Order::getCreateTime);
        if (status != null) w.eq(Order::getStatus, status);
        if (userId != null) w.eq(Order::getUserId, userId);
        return page(new Page<>(page, size), w);
    }

    /**
     * 取消订单
     */
    @Transactional(rollbackFor = Exception.class)
    public void cancel(Long orderId) {
        Order o = getById(orderId);
        if (o == null) throw new BizException(ErrorCode.ORDER_NOT_FOUND);
        if (o.getStatus() != 0) {
            throw new BizException(ErrorCode.ORDER_STATUS_INVALID, "只有待付款订单可取消");
        }
        // 恢复库存
        // 真实业务:解析 goods JSON 数组,逐个 inc
        o.setStatus(-1);
        o.setUpdateTime(LocalDateTime.now());
        updateById(o);
        log.info("订单已取消: id={}, orderNo={}", o.getId(), o.getOrderNo());
    }

    /**
     * 退款审批
     */
    @Transactional(rollbackFor = Exception.class)
    public void approveRefund(Long orderId, boolean approve, String note) {
        Order o = getById(orderId);
        if (o == null) throw new BizException(ErrorCode.ORDER_NOT_FOUND);
        if (o.getStatus() != 5) { // 5 = 退款处理中
            throw new BizException(ErrorCode.ORDER_REFUNDING, "订单不在退款处理中");
        }
        o.setStatus(approve ? -2 : 4);
        o.setUpdateTime(LocalDateTime.now());
        updateById(o);
        log.info("退款审批: orderId={}, approve={}, note={}", orderId, approve, note);
    }

    /**
     * 发货
     */
    public void ship(Long orderId, String logistics) {
        Order o = getById(orderId);
        if (o == null) throw new BizException(ErrorCode.ORDER_NOT_FOUND);
        if (o.getStatus() != 1) {
            throw new BizException(ErrorCode.ORDER_STATUS_INVALID);
        }
        o.setStatus(2);
        o.setShipTime(LocalDateTime.now());
        o.setUpdateTime(LocalDateTime.now());
        // 真实业务: 存物流号到 logistics 字段
        updateById(o);
    }

    /**
     * 看板统计
     */
    public Map<String, Object> dashboard() {
        LocalDateTime today = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0);
        Map<String, Object> todayR = baseMapper.revenueSince(today);
        Map<String, Object> result = new HashMap<>();
        result.put("todayRevenue", todayR.getOrDefault("revenue", BigDecimal.ZERO));
        result.put("todayCount", todayR.getOrDefault("cnt", 0));
        result.put("totalStock", baseMapper.totalStock());
        // 状态分布
        result.put("statusDistribution", baseMapper.statusDistribution(today));
        return result;
    }
}
