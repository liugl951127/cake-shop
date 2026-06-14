-- ============================================
-- 甜心蛋糕 - 管理后台数据库(MYSQL 8.0+)
-- 配合 Spring Boot + MyBatis-Plus 使用
-- ============================================

CREATE DATABASE IF NOT EXISTS cake_shop DEFAULT CHARSET utf8mb4;
USE cake_shop;

-- 员工/管理员
CREATE TABLE IF NOT EXISTS employees (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL COMMENT '姓名',
    phone VARCHAR(20) NOT NULL UNIQUE COMMENT '手机号',
    role VARCHAR(30) NOT NULL COMMENT '角色 super_admin/admin/operator/finance/customer_service/readonly',
    password VARCHAR(100) NOT NULL COMMENT 'BCrypt 加密',
    avatar VARCHAR(500),
    status TINYINT DEFAULT 1 COMMENT '1-正常 0-禁用',
    last_login_ip VARCHAR(50),
    last_login_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by VARCHAR(50),
    update_by VARCHAR(50),
    deleted TINYINT DEFAULT 0,
    INDEX idx_role (role),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='员工/管理员';

-- 商品
CREATE TABLE IF NOT EXISTS goods (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image VARCHAR(500),
    images JSON,
    price DECIMAL(10,2) DEFAULT 0,
    origin_price DECIMAL(10,2) DEFAULT 0,
    cost_price DECIMAL(10,2) DEFAULT 0,
    stock INT DEFAULT 0,
    sales INT DEFAULT 0,
    category_id BIGINT,
    category_name VARCHAR(50),
    shop_id BIGINT,
    tags JSON,
    specs JSON,
    status TINYINT DEFAULT 0 COMMENT '0-下架 1-上架',
    featured TINYINT DEFAULT 0,
    sort INT DEFAULT 0,
    version INT DEFAULT 0 COMMENT '乐观锁',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by VARCHAR(50),
    update_by VARCHAR(50),
    deleted TINYINT DEFAULT 0,
    INDEX idx_status_sort (status, sort),
    INDEX idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品';

-- 订单
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_no VARCHAR(64) NOT NULL UNIQUE,
    out_trade_no VARCHAR(64),
    transaction_id VARCHAR(64),
    user_id BIGINT NOT NULL,
    openid VARCHAR(64),
    shop_id BIGINT,
    shop_name VARCHAR(100),
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0待付 1已付 2配送 3待收 4完成 -1取消 -2退款 -3风控',
    dispatch_status TINYINT DEFAULT 0,
    rider_id BIGINT,
    rider_name VARCHAR(50),
    address JSON,
    goods JSON,
    remark VARCHAR(500),
    goods_price DECIMAL(10,2) DEFAULT 0,
    freight DECIMAL(10,2) DEFAULT 0,
    member_discount DECIMAL(10,2) DEFAULT 0,
    coupon_discount DECIMAL(10,2) DEFAULT 0,
    points_discount DECIMAL(10,2) DEFAULT 0,
    promo_discount DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(10,2) DEFAULT 0,
    is_self_pickup TINYINT DEFAULT 0,
    store_id VARCHAR(64),
    is_gift TINYINT DEFAULT 0,
    gift_msg VARCHAR(500),
    pay_time DATETIME,
    ship_time DATETIME,
    complete_time DATETIME,
    expire_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    create_by VARCHAR(50),
    update_by VARCHAR(50),
    deleted TINYINT DEFAULT 0,
    INDEX idx_status (status),
    INDEX idx_user (user_id),
    INDEX idx_pay_time (pay_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单';

-- 风控日志
CREATE TABLE IF NOT EXISTS risk_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    scenario VARCHAR(20) NOT NULL COMMENT 'pay/withdraw/login/register',
    user_id BIGINT,
    openid VARCHAR(64),
    device_id VARCHAR(64),
    ip VARCHAR(50),
    phone VARCHAR(20),
    id_card_hash VARCHAR(64),
    order_id BIGINT,
    amount DECIMAL(10,2),
    factors JSON,
    total_score INT,
    threshold INT,
    decision VARCHAR(20) COMMENT 'pass/verify/manual/reject',
    require_action JSON,
    review_status VARCHAR(20) DEFAULT 'auto' COMMENT 'auto/pending/approved/rejected',
    review_by VARCHAR(50),
    review_note VARCHAR(500),
    review_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_decision (decision),
    INDEX idx_review_status (review_status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='风控日志';

-- 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    operator_id VARCHAR(50),
    operator_name VARCHAR(50),
    action VARCHAR(50),
    target_type VARCHAR(30),
    target_id VARCHAR(50),
    detail JSON,
    ip VARCHAR(50),
    user_agent VARCHAR(500),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_operator (operator_id),
    INDEX idx_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志';

-- 初始超级管理员(密码 123456,登录后请改)
INSERT INTO employees(name, phone, role, password, status)
VALUES ('超级管理员', 'admin', 'super_admin',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 1);
