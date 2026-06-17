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
