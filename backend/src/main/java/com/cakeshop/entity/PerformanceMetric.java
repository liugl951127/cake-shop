package com.cakeshop.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 性能指标
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("performance_metrics")
public class PerformanceMetric extends BaseEntity {
    private String name;
    private Double value;
    private String tags;        // JSON
    private String tenantId;
    private Long ts;
}
