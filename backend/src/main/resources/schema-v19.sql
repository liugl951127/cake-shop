-- ============================================
-- v19.0 企业级能力 - 增量表
-- tenants / audit_logs / performance_metrics / error_reports
-- ============================================

USE cake_shop;

-- 租户表
CREATE TABLE IF NOT EXISTS tenants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL UNIQUE COMMENT '租户 code (外部识别)',
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'active/disabled',
    plan VARCHAR(20) NOT NULL DEFAULT 'free' COMMENT 'free/pro/enterprise',
    expire_at BIGINT NOT NULL DEFAULT 0 COMMENT '过期时间(毫秒)',
    quota JSON COMMENT '额度配额: users/orders/apiCallsPerDay/storageGB',
    contact JSON,
    remark VARCHAR(500),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_code (code),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='多租户';

-- 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    action VARCHAR(100) NOT NULL COMMENT 'order.cancel/tenant.update/...',
    target_type VARCHAR(30) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    operator_id VARCHAR(50),
    operator_name VARCHAR(50),
    operator_role VARCHAR(30),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    detail JSON,
    before_state JSON COMMENT '变更前快照',
    after_state JSON COMMENT '变更后快照',
    ip VARCHAR(50),
    user_agent VARCHAR(500),
    severity VARCHAR(20) DEFAULT 'info' COMMENT 'info/warn/critical',
    result VARCHAR(20) DEFAULT 'success' COMMENT 'success/fail',
    error_msg VARCHAR(1000),
    replayable TINYINT DEFAULT 0,
    ts BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_action (action),
    INDEX idx_target (target_type, target_id),
    INDEX idx_operator (operator_id),
    INDEX idx_tenant (tenant_id),
    INDEX idx_ts (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作审计';

-- 性能指标
CREATE TABLE IF NOT EXISTS performance_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL COMMENT 'cf.latency/api.qps/db.query',
    value DOUBLE NOT NULL,
    tags JSON,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    ts BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_name (name),
    INDEX idx_tenant_name (tenant_id, name),
    INDEX idx_ts (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='性能指标';

-- 异常上报
CREATE TABLE IF NOT EXISTS error_reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    fingerprint VARCHAR(64) NOT NULL COMMENT '去重指纹',
    message VARCHAR(2000) NOT NULL,
    stack TEXT,
    type VARCHAR(50),
    scene VARCHAR(100),
    level VARCHAR(20) DEFAULT 'error',
    context JSON,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    user_id VARCHAR(64),
    device_id VARCHAR(64),
    count INT DEFAULT 1,
    ts BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_fingerprint (fingerprint),
    INDEX idx_tenant (tenant_id),
    INDEX idx_ts (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='异常上报';

-- 租户额度计数器
CREATE TABLE IF NOT EXISTS tenant_counters (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(50) NOT NULL COMMENT 'users/orders/apiCalls/storageGB',
    value BIGINT NOT NULL DEFAULT 0,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_tenant_name (tenant_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户额度计数';

-- 默认租户
INSERT IGNORE INTO tenants(code, name, status, plan, expire_at, quota)
VALUES ('default', '默认租户', 'active', 'enterprise',
        UNIX_TIMESTAMP(DATE_ADD(NOW(), INTERVAL 10 YEAR)) * 1000,
        '{"users":1000000,"orders":10000000,"apiCallsPerDay":100000000,"storageGB":10000}');
