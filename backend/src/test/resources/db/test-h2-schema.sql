-- ============================================
-- H2 测试 schema (最小化, 但覆盖所有启动需要的表)
-- 兼容 MyBatis-Plus + H2
-- 注意: TenantInterceptor 在每个请求前查 tenant 表
-- ============================================

-- tenant (登录请求触发的拦截器必查)
CREATE TABLE IF NOT EXISTS tenant (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    plan VARCHAR(500),
    expire_at BIGINT,
    quota TEXT,
    contact TEXT,
    remark TEXT,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    create_by VARCHAR(50) DEFAULT '',
    update_by VARCHAR(50) DEFAULT ''
);

-- employee
CREATE TABLE IF NOT EXISTS employee (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'operator',
    password VARCHAR(200) NOT NULL,
    avatar VARCHAR(500),
    status TINYINT NOT NULL DEFAULT 1,
    permissions TEXT,
    last_login_ip VARCHAR(64),
    last_login_time TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    create_by VARCHAR(50) DEFAULT '',
    update_by VARCHAR(50) DEFAULT ''
);

-- 初始数据
INSERT INTO tenant (id, code, name, status) VALUES (1, 'default', '甜心蛋糕主店', 'active');

-- goods (PerformanceTests 需要)
CREATE TABLE IF NOT EXISTS goods (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image VARCHAR(500),
    images TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    origin_price DECIMAL(10,2) DEFAULT 0,
    cost_price DECIMAL(10,2) DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    sales INT NOT NULL DEFAULT 0,
    category_id BIGINT DEFAULT 0,
    category_name VARCHAR(200),
    shop_id BIGINT DEFAULT 0,
    tags VARCHAR(500),
    specs TEXT,
    status INT NOT NULL DEFAULT 1,
    featured TINYINT DEFAULT 0,
    sort INT NOT NULL DEFAULT 0,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    create_by VARCHAR(50) DEFAULT '',
    update_by VARCHAR(50) DEFAULT ''
);

-- orders (后续 test 用)
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(50) NOT NULL,
    user_id BIGINT,
    user_name VARCHAR(200),
    total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    status INT NOT NULL DEFAULT 0,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    create_by VARCHAR(50) DEFAULT '',
    update_by VARCHAR(50) DEFAULT ''
);

-- member
CREATE TABLE IF NOT EXISTS member (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(100),
    nickname VARCHAR(200),
    phone VARCHAR(20),
    level INT NOT NULL DEFAULT 0,
    points INT NOT NULL DEFAULT 0,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    create_by VARCHAR(50) DEFAULT '',
    update_by VARCHAR(50) DEFAULT ''
);
