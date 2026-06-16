-- ============================================
-- 甜心蛋糕 - 数据库 Schema
-- MySQL 8.0+
-- ============================================
DROP DATABASE IF EXISTS cake_shop;
CREATE DATABASE cake_shop DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cake_shop;

-- ============================================
-- 1. 商品表
-- ============================================
CREATE TABLE `goods` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(200) NOT NULL,
  `category`     VARCHAR(50)  NOT NULL,
  `sub_category` VARCHAR(50)  DEFAULT '',
  `price`        DECIMAL(10,2) NOT NULL DEFAULT 0,
  `origin_price` DECIMAL(10,2) DEFAULT 0,
  `stock`        INT          NOT NULL DEFAULT 0,
  `sales`        INT          NOT NULL DEFAULT 0,
  `image`        VARCHAR(500) DEFAULT '',
  `images`       TEXT         COMMENT 'JSON 数组',
  `description`  TEXT,
  `tags`         VARCHAR(500) DEFAULT '' COMMENT '逗号分隔',
  `status`       TINYINT      NOT NULL DEFAULT 0 COMMENT '0=下架 1=在售',
  `recommend`    TINYINT      NOT NULL DEFAULT 0 COMMENT '0/1',
  `sort`         INT          NOT NULL DEFAULT 0,
  `create_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`      TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_recommend` (`recommend`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 2. 订单表
-- ============================================
CREATE TABLE `orders` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT,
  `order_no`      VARCHAR(50)  NOT NULL,
  `user_id`       BIGINT       NOT NULL,
  `openid`        VARCHAR(100) DEFAULT '',
  `status`        TINYINT      NOT NULL DEFAULT 0 COMMENT '0待付款 1待发货 2配送中 3待收货 4已完成 -1已取消 -2已退款 -3拦截',
  `total_price`   DECIMAL(10,2) NOT NULL DEFAULT 0,
  `pay_price`     DECIMAL(10,2) NOT NULL DEFAULT 0,
  `freight`       DECIMAL(10,2) NOT NULL DEFAULT 0,
  `discount`      DECIMAL(10,2) NOT NULL DEFAULT 0,
  `coupon_id`     BIGINT       DEFAULT 0,
  `goods_json`    TEXT         COMMENT 'JSON 数组',
  `address_id`    BIGINT       DEFAULT 0,
  `address_json`  TEXT,
  `remark`        VARCHAR(500) DEFAULT '',
  `pay_time`      DATETIME     DEFAULT NULL,
  `pay_method`    VARCHAR(20)  DEFAULT '' COMMENT 'wxpay/balance/cod',
  `pay_trade_no`  VARCHAR(100) DEFAULT '',
  `ship_time`     DATETIME     DEFAULT NULL,
  `finish_time`   DATETIME     DEFAULT NULL,
  `cancel_time`   DATETIME     DEFAULT NULL,
  `refund_reason` VARCHAR(500) DEFAULT '',
  `refund_time`   DATETIME     DEFAULT NULL,
  `logistics_no`  VARCHAR(100) DEFAULT '',
  `logistics_company` VARCHAR(50) DEFAULT '',
  `create_time`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`       TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 3. 会员表
-- ============================================
CREATE TABLE `member` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT       NOT NULL,
  `openid`         VARCHAR(100) NOT NULL,
  `nickname`       VARCHAR(100) DEFAULT '',
  `avatar`         VARCHAR(500) DEFAULT '',
  `phone`          VARCHAR(20)  DEFAULT '',
  `level`          VARCHAR(20)  NOT NULL DEFAULT 'basic' COMMENT 'basic/silver/gold/diamond',
  `growth`         INT          NOT NULL DEFAULT 0,
  `balance`        DECIMAL(10,2) NOT NULL DEFAULT 0,
  `frozen`         DECIMAL(10,2) NOT NULL DEFAULT 0,
  `points`         INT          NOT NULL DEFAULT 0,
  `total_spend`    DECIMAL(10,2) NOT NULL DEFAULT 0,
  `discount`       DECIMAL(3,2) NOT NULL DEFAULT 1.00 COMMENT '会员折扣 0.95/0.9/0.85',
  `is_admin`       TINYINT      NOT NULL DEFAULT 0,
  `status`         TINYINT      NOT NULL DEFAULT 1 COMMENT '0=禁用 1=正常',
  `register_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login_time` DATETIME    DEFAULT NULL,
  `create_time`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`        TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  UNIQUE KEY `uk_openid` (`openid`),
  KEY `idx_level` (`level`),
  KEY `idx_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. 优惠券表
-- ============================================
CREATE TABLE `coupon` (
  `id`              BIGINT       NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(200) NOT NULL,
  `type`            VARCHAR(20)  NOT NULL DEFAULT 'amount' COMMENT 'amount/percent',
  `amount`          DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '满减金额/折扣',
  `min_spend`       DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '最低消费',
  `total`           INT          NOT NULL DEFAULT 0 COMMENT '总发行量',
  `remain`          INT          NOT NULL DEFAULT 0,
  `per_limit`       INT          NOT NULL DEFAULT 1 COMMENT '每人限领',
  `start_time`      DATETIME     NOT NULL,
  `end_time`        DATETIME     NOT NULL,
  `status`          TINYINT      NOT NULL DEFAULT 1,
  `create_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`         TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_start_end` (`start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户领取的优惠券
CREATE TABLE `member_coupon` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `member_id`    BIGINT       NOT NULL,
  `coupon_id`    BIGINT       NOT NULL,
  `status`       TINYINT      NOT NULL DEFAULT 0 COMMENT '0未使用 1已使用 2已过期',
  `used_time`    DATETIME     DEFAULT NULL,
  `used_order_id` BIGINT      DEFAULT 0,
  `receive_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expire_time`  DATETIME     NOT NULL,
  `create_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted`      TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_member` (`member_id`),
  KEY `idx_coupon` (`coupon_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 5. 购物车
-- ============================================
CREATE TABLE `cart` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NOT NULL,
  `goods_id`    BIGINT       NOT NULL,
  `spec`        VARCHAR(200) DEFAULT '' COMMENT 'JSON 规格',
  `count`       INT          NOT NULL DEFAULT 1,
  `selected`    TINYINT      NOT NULL DEFAULT 1,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  UNIQUE KEY `uk_user_goods` (`user_id`, `goods_id`, `spec`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 6. 收藏
-- ============================================
CREATE TABLE `favorite` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NOT NULL,
  `goods_id`    BIGINT       NOT NULL,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_goods` (`user_id`, `goods_id`, `deleted`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 7. 收货地址
-- ============================================
CREATE TABLE `address` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NOT NULL,
  `name`        VARCHAR(50)  NOT NULL,
  `phone`       VARCHAR(20)  NOT NULL,
  `region`      VARCHAR(200) NOT NULL COMMENT '省/市/区',
  `address`     VARCHAR(500) NOT NULL,
  `detail`      VARCHAR(500) DEFAULT '',
  `is_default`  TINYINT      NOT NULL DEFAULT 0,
  `tag`         VARCHAR(20)  DEFAULT '' COMMENT '家/公司/学校',
  `lat`         DECIMAL(10,6) DEFAULT 0,
  `lng`         DECIMAL(10,6) DEFAULT 0,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_default` (`user_id`, `is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 8. 限时秒杀
-- ============================================
CREATE TABLE `seckill` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `goods_id`    BIGINT       NOT NULL,
  `name`        VARCHAR(200) NOT NULL,
  `image`       VARCHAR(500) DEFAULT '',
  `seckill_price` DECIMAL(10,2) NOT NULL,
  `origin_price` DECIMAL(10,2) NOT NULL,
  `stock`       INT          NOT NULL DEFAULT 0,
  `total`       INT          NOT NULL DEFAULT 0,
  `sold`        INT          NOT NULL DEFAULT 0,
  `per_limit`   INT          NOT NULL DEFAULT 2,
  `start_time`  DATETIME     NOT NULL,
  `end_time`    DATETIME     NOT NULL,
  `status`      TINYINT      NOT NULL DEFAULT 1,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_goods` (`goods_id`),
  KEY `idx_status_time` (`status`, `start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `seckill_order` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `seckill_id`  BIGINT       NOT NULL,
  `user_id`     BIGINT       NOT NULL,
  `order_id`    BIGINT       NOT NULL,
  `price`       DECIMAL(10,2) NOT NULL,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_seckill_user` (`seckill_id`, `user_id`)
  `create_by`    VARCHAR(50)  DEFAULT '',
  `update_by`    VARCHAR(50)  DEFAULT '',
  `update_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`      TINYINT(1)   NOT NULL DEFAULT 0,
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 9. 拼团
-- ============================================
CREATE TABLE `group_buy` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `goods_id`    BIGINT       NOT NULL,
  `name`        VARCHAR(200) NOT NULL,
  `image`       VARCHAR(500) DEFAULT '',
  `group_price` DECIMAL(10,2) NOT NULL,
  `origin_price` DECIMAL(10,2) NOT NULL,
  `people_num`  INT          NOT NULL DEFAULT 2,
  `hours`       INT          NOT NULL DEFAULT 24,
  `stock`       INT          NOT NULL DEFAULT 0,
  `sold`        INT          NOT NULL DEFAULT 0,
  `start_time`  DATETIME     NOT NULL,
  `end_time`    DATETIME     NOT NULL,
  `status`      TINYINT      NOT NULL DEFAULT 1,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_status_time` (`status`, `start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `group_member` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `group_id`    BIGINT       NOT NULL COMMENT '拼团 ID (同一 group 的成员 group_id 相同)',
  `group_buy_id` BIGINT      NOT NULL,
  `user_id`     BIGINT       NOT NULL,
  `is_leader`   TINYINT      NOT NULL DEFAULT 0,
  `order_id`    BIGINT       NOT NULL,
  `status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '0拼团中 1已成团 2失败',
  `join_time`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finish_time` DATETIME     DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_group` (`group_id`),
  KEY `idx_user` (`user_id`)
  `create_by`    VARCHAR(50)  DEFAULT '',
  `update_by`    VARCHAR(50)  DEFAULT '',
  `update_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`      TINYINT(1)   NOT NULL DEFAULT 0,
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 10. 评价
-- ============================================
CREATE TABLE `review` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NOT NULL,
  `goods_id`    BIGINT       NOT NULL,
  `order_id`    BIGINT       NOT NULL,
  `score`       TINYINT      NOT NULL DEFAULT 5 COMMENT '1-5',
  `content`     VARCHAR(1000) NOT NULL,
  `images`      TEXT COMMENT 'JSON',
  `tags`        VARCHAR(200) DEFAULT '',
  `is_anonymous` TINYINT     NOT NULL DEFAULT 0,
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '0=隐藏 1=显示',
  `reply`       VARCHAR(1000) DEFAULT '',
  `reply_time`  DATETIME     DEFAULT NULL,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_goods` (`goods_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 11. 钱包流水
-- ============================================
CREATE TABLE `wallet_log` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NOT NULL,
  `type`        VARCHAR(20)  NOT NULL COMMENT 'recharge/withdraw/pay/refund/reward',
  `amount`      DECIMAL(10,2) NOT NULL,
  `balance_before` DECIMAL(10,2) NOT NULL,
  `balance_after` DECIMAL(10,2) NOT NULL,
  `ref_id`      VARCHAR(100) DEFAULT '' COMMENT '订单号/退款单号',
  `remark`      VARCHAR(200) DEFAULT '',
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_create_time` (`create_time`)
  `create_by`    VARCHAR(50)  DEFAULT '',
  `update_by`    VARCHAR(50)  DEFAULT '',
  `update_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`      TINYINT(1)   NOT NULL DEFAULT 0,
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 提现申请
CREATE TABLE `withdraw` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NOT NULL,
  `amount`      DECIMAL(10,2) NOT NULL,
  `fee`         DECIMAL(10,2) NOT NULL DEFAULT 0,
  `actual`      DECIMAL(10,2) NOT NULL,
  `account`     VARCHAR(200) NOT NULL COMMENT '支付宝/微信账号',
  `account_name` VARCHAR(50) NOT NULL,
  `status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '0待审 1通过 -1拒绝 2已打款',
  `audit_time`  DATETIME     DEFAULT NULL,
  `audit_by`    VARCHAR(50)  DEFAULT '',
  `audit_note`  VARCHAR(500) DEFAULT '',
  `pay_time`    DATETIME     DEFAULT NULL,
  `pay_trade_no` VARCHAR(100) DEFAULT '',
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 12. 福袋 (抽奖)
-- ============================================
CREATE TABLE `lottery_prize` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(200) NOT NULL,
  `image`       VARCHAR(500) DEFAULT '',
  `type`        VARCHAR(20)  NOT NULL DEFAULT 'thanks' COMMENT 'coupon/goods/thanks/points',
  `value`       DECIMAL(10,2) NOT NULL DEFAULT 0,
  `weight`      INT          NOT NULL DEFAULT 1,
  `stock`       INT          NOT NULL DEFAULT 0,
  `total`       INT          NOT NULL DEFAULT 0,
  `status`      TINYINT      NOT NULL DEFAULT 1,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `lottery_record` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NOT NULL,
  `prize_id`    BIGINT       NOT NULL,
  `prize_name`  VARCHAR(200) NOT NULL,
  `prize_type`  VARCHAR(20)  NOT NULL,
  `status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '0未发奖 1已发奖',
  `claimed_time` DATETIME    DEFAULT NULL,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`)
  `create_by`    VARCHAR(50)  DEFAULT '',
  `update_by`    VARCHAR(50)  DEFAULT '',
  `update_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`      TINYINT(1)   NOT NULL DEFAULT 0,
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 13. 客服会话
-- ============================================
CREATE TABLE `chat_session` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NOT NULL,
  `agent_id`    BIGINT       DEFAULT 0 COMMENT '客服 0=AI',
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'ai' COMMENT 'ai/agent/closed/transferred',
  `type`        VARCHAR(20)  DEFAULT 'service',
  `last_msg`    VARCHAR(500) DEFAULT '',
  `last_msg_time` DATETIME   DEFAULT NULL,
  `unread_user` INT          NOT NULL DEFAULT 0,
  `unread_agent` INT         NOT NULL DEFAULT 0,
  `rating`      TINYINT      DEFAULT NULL,
  `rating_text` VARCHAR(500) DEFAULT '',
  `rating_time` DATETIME     DEFAULT NULL,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_agent` (`agent_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `chat_message` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `session_id`  BIGINT       NOT NULL,
  `from_side`   VARCHAR(10)  NOT NULL COMMENT 'user/agent/system',
  `msg_type`    VARCHAR(20)  NOT NULL DEFAULT 'text' COMMENT 'text/image/video/location/file',
  `content`     TEXT,
  `rich_json`   TEXT COMMENT '富文本节点',
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_session` (`session_id`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 14. 公告 / CMS
-- ============================================
CREATE TABLE `notice` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `title`       VARCHAR(200) NOT NULL,
  `content`     TEXT,
  `category`    VARCHAR(50)  DEFAULT 'notice' COMMENT 'notice/help/announcement',
  `image`       VARCHAR(500) DEFAULT '',
  `top`         TINYINT      NOT NULL DEFAULT 0,
  `status`      TINYINT      NOT NULL DEFAULT 1,
  `view_count`  INT          NOT NULL DEFAULT 0,
  `start_time`  DATETIME     DEFAULT NULL,
  `end_time`    DATETIME     DEFAULT NULL,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_status_top` (`status`, `top`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `cms_page` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `key`         VARCHAR(100) NOT NULL,
  `title`       VARCHAR(200) NOT NULL,
  `content`     LONGTEXT,
  `extra`       TEXT COMMENT 'JSON',
  `status`      TINYINT      NOT NULL DEFAULT 1,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 15. 员工 (admin 账号)
-- ============================================
CREATE TABLE `employee` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `username`    VARCHAR(50)  NOT NULL,
  `password`    VARCHAR(200) NOT NULL,
  `name`        VARCHAR(50)  NOT NULL,
  `phone`       VARCHAR(20)  DEFAULT '',
  `email`       VARCHAR(100) DEFAULT '',
  `role`        VARCHAR(50)  NOT NULL DEFAULT 'operator' COMMENT 'super_admin/admin/operator/finance/cs',
  `permissions` TEXT COMMENT 'JSON 数组',
  `status`      TINYINT      NOT NULL DEFAULT 1,
  `last_login`  DATETIME     DEFAULT NULL,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 租户
CREATE TABLE `tenant` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `code`        VARCHAR(50)  NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `status`      TINYINT      NOT NULL DEFAULT 1,
  `config`      TEXT COMMENT 'JSON',
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 审计日志
CREATE TABLE `audit_log` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       DEFAULT 0,
  `employee_id` BIGINT       DEFAULT 0,
  `action`      VARCHAR(50)  NOT NULL,
  `resource`    VARCHAR(100) DEFAULT '',
  `method`      VARCHAR(10)  DEFAULT '',
  `path`        VARCHAR(500) DEFAULT '',
  `ip`          VARCHAR(50)  DEFAULT '',
  `ua`          VARCHAR(500) DEFAULT '',
  `params`      TEXT,
  `result`      TINYINT      NOT NULL DEFAULT 0,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_action` (`action`),
  KEY `idx_create_time` (`create_time`)
  `create_by`    VARCHAR(50)  DEFAULT '',
  `update_by`    VARCHAR(50)  DEFAULT '',
  `update_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`      TINYINT(1)   NOT NULL DEFAULT 0,
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 错误上报
CREATE TABLE `error_report` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       DEFAULT 0,
  `app_id`      VARCHAR(50)  DEFAULT '',
  `version`     VARCHAR(50)  DEFAULT '',
  `platform`    VARCHAR(50)  DEFAULT '',
  `type`        VARCHAR(50)  DEFAULT 'js',
  `message`     TEXT,
  `stack`       TEXT,
  `path`        VARCHAR(500) DEFAULT '',
  `extra`       TEXT,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_create_time` (`create_time`)
  `create_by`    VARCHAR(50)  DEFAULT '',
  `update_by`    VARCHAR(50)  DEFAULT '',
  `update_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`      TINYINT(1)   NOT NULL DEFAULT 0,
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 性能监控
CREATE TABLE `performance_metric` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `app_id`      VARCHAR(50)  DEFAULT '',
  `version`     VARCHAR(50)  DEFAULT '',
  `page`        VARCHAR(200) DEFAULT '',
  `metric_name` VARCHAR(50)  NOT NULL,
  `value`       DECIMAL(15,4) NOT NULL,
  `extra`       TEXT,
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_page` (`page`),
  KEY `idx_metric` (`metric_name`),
  KEY `idx_create_time` (`create_time`)
  `create_by`    VARCHAR(50)  DEFAULT '',
  `update_by`    VARCHAR(50)  DEFAULT '',
  `update_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`      TINYINT(1)   NOT NULL DEFAULT 0,
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 风控日志
CREATE TABLE `risk_log` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       DEFAULT 0,
  `openid`      VARCHAR(100) DEFAULT '',
  `scenario`    VARCHAR(50)  NOT NULL,
  `total_score` INT          NOT NULL DEFAULT 0,
  `decision`    VARCHAR(20)  NOT NULL COMMENT 'pass/review/reject/block',
  `factors`     TEXT COMMENT 'JSON 命中的因子',
  `threshold`   VARCHAR(200) DEFAULT '',
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_scenario` (`scenario`),
  KEY `idx_decision` (`decision`)
  `create_by`    VARCHAR(50)  DEFAULT '',
  `update_by`    VARCHAR(50)  DEFAULT '',
  `update_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`      TINYINT(1)   NOT NULL DEFAULT 0,
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 初始数据
-- ============================================
INSERT INTO `tenant` (`code`, `name`, `status`) VALUES ('default', '甜心蛋糕主店', 1);

-- 默认商品
INSERT INTO `goods` (`name`, `category`, `price`, `origin_price`, `stock`, `sales`, `image`, `description`, `tags`, `status`, `recommend`, `sort`) VALUES
('草莓鲜奶蛋糕', 'cake', 168.00, 198.00, 100, 250, '/images/g_strawberry.png', '新鲜草莓+动物奶油+戚风蛋糕', '新品,热卖,生日', 1, 1, 100),
('巧克力熔岩蛋糕', 'cake', 158.00, 188.00, 80, 180, '/images/g_chocolate.png', '浓郁巧克力,内含熔岩夹心', '热卖,生日', 1, 1, 99),
('提拉米苏', 'sweet', 88.00, 108.00, 60, 120, '/images/g_tiramisu.png', '意式经典,咖啡酒+马斯卡彭', '经典,人气', 1, 1, 80),
('芒果慕斯', 'sweet', 78.00, 98.00, 50, 95, '/images/g_mango.png', '海南金煌芒+轻盈慕斯', '新品', 1, 1, 79),
('丹麦手撕面包', 'bread', 28.00, 38.00, 200, 320, '/images/g_bread.png', '现烤现卖,层层酥脆', '手工,早餐', 1, 0, 50),
('可颂黄油面包', 'bread', 18.00, 25.00, 300, 480, '/images/g_croissant.png', '法国AOP黄油,3天保质期', '早餐,热卖', 1, 1, 49),
('美式咖啡', 'coffee', 25.00, 35.00, 999, 1200, '/images/g_coffee.png', '现磨阿拉比卡咖啡豆', '现磨', 1, 0, 30),
('拿铁咖啡', 'coffee', 28.00, 38.00, 999, 980, '/images/g_latte.png', '意式浓缩+鲜牛奶+拉花', '现磨', 1, 0, 29),
('曲奇饼干', 'snack', 36.00, 48.00, 200, 350, '/images/g_cookie.png', '黄油曲奇,9 种口味混装', '零食,礼盒', 1, 0, 20),
('蛋黄酥礼盒', 'snack', 88.00, 128.00, 100, 220, '/images/g_yolk.png', '现烤蛋黄酥,8 颗装', '礼盒,节日', 1, 0, 19);

-- 初始会员
INSERT INTO `member` (`user_id`, `openid`, `nickname`, `phone`, `level`, `growth`, `balance`, `points`, `total_spend`, `discount`, `is_admin`, `status`) VALUES
(10001, 'test_openid_001', '测试用户', '13800000001', 'gold', 1500, 100.00, 500, 1280.00, 0.90, 0, 1),
(10002, 'test_openid_002', '老王', '13800000002', 'basic', 100, 50.00, 50, 50.00, 1.00, 0, 1),
(1, 'admin_openid', '系统管理员', '13800000000', 'diamond', 99999, 0.00, 99999, 0.00, 0.85, 1, 1);

-- 初始优惠券
INSERT INTO `coupon` (`name`, `type`, `amount`, `min_spend`, `total`, `remain`, `per_limit`, `start_time`, `end_time`) VALUES
('新人首单立减 10 元', 'amount', 10.00, 0.00, 9999, 9999, 1, '2024-01-01 00:00:00', '2030-12-31 23:59:59'),
('满 99 减 20', 'amount', 20.00, 99.00, 5000, 5000, 1, '2024-01-01 00:00:00', '2030-12-31 23:59:59'),
('满 199 减 50', 'amount', 50.00, 199.00, 3000, 3000, 1, '2024-01-01 00:00:00', '2030-12-31 23:59:59'),
('生日蛋糕 8.5 折', 'percent', 0.85, 100.00, 1000, 1000, 1, '2024-01-01 00:00:00', '2030-12-31 23:59:59');

-- 秒杀
INSERT INTO `seckill` (`goods_id`, `name`, `image`, `seckill_price`, `origin_price`, `stock`, `total`, `sold`, `per_limit`, `start_time`, `end_time`) VALUES
(1, '草莓鲜奶蛋糕 - 限时秒杀', '/images/g_strawberry.png', 99.00, 168.00, 50, 50, 0, 2, '2024-01-01 00:00:00', '2030-12-31 23:59:59'),
(2, '巧克力熔岩 - 限时秒杀', '/images/g_chocolate.png', 88.00, 158.00, 30, 30, 0, 2, '2024-01-01 00:00:00', '2030-12-31 23:59:59');

-- 拼团
INSERT INTO `group_buy` (`goods_id`, `name`, `image`, `group_price`, `origin_price`, `people_num`, `hours`, `stock`, `sold`, `start_time`, `end_time`) VALUES
(1, '草莓蛋糕 2 人团', '/images/g_strawberry.png', 99.00, 168.00, 2, 24, 100, 0, '2024-01-01 00:00:00', '2030-12-31 23:59:59'),
(3, '提拉米苏 3 人团', '/images/g_tiramisu.png', 58.00, 88.00, 3, 24, 80, 0, '2024-01-01 00:00:00', '2030-12-31 23:59:59');

-- 公告
INSERT INTO `notice` (`title`, `content`, `category`, `image`, `top`, `status`) VALUES
('新人首单立减 10 元, 满 99 包邮!', '欢迎来到甜心蛋糕!新用户注册即可领取 10 元优惠券,满 99 元全国包邮。', 'notice', '', 1, 1),
('生日蛋糕购买须知', '1. 请提前 24 小时预订\n2. 蛋糕尺寸: 6 寸/8 寸/10 寸/12 寸\n3. 配送范围: 3 公里内,超出加收配送费\n4. 收货后请立即检查,有问题 2 小时内联系客服', 'help', '', 0, 1),
('关于食材与安全', '我们使用动物奶油、新鲜水果、保质期内原料,所有产品 0 添加防腐剂。', 'announcement', '', 0, 1);

-- CMS 页面
INSERT INTO `cms_page` (`key`, `title`, `content`) VALUES
('birthday-notice', '生日蛋糕购买须知', '# 生日蛋糕购买须知\n\n## 1. 预订\n- 请**提前 24 小时**预订\n- 紧急订单请联系客服\n\n## 2. 规格\n| 尺寸 | 适合人数 | 价格 |\n|---|---|---|\n| 6 寸 | 2-3 人 | 168 元起 |\n| 8 寸 | 4-6 人 | 268 元起 |\n| 10 寸 | 7-10 人 | 388 元起 |\n| 12 寸 | 11-15 人 | 568 元起 |\n\n## 3. 配送\n- 配送范围: 3 公里内免运费\n- 超出范围: 5 元/公里\n- 配送时间: 9:00 - 21:00\n\n## 4. 售后\n- 收货后 2 小时内检查\n- 有问题联系客服 100% 退款\n\n## 5. 定制\n- 个性化祝福语 (免费)\n- 定制图片 (免费)\n- 特殊造型 (另议)'),
('about', '关于我们', '甜心蛋糕成立于 2020 年,坚持使用动物奶油、新鲜水果、0 添加防腐剂,只为给您最好的味道。\n\n联系电话: 400-123-4567\n微信公众号: 甜心蛋糕\n门店地址: 上海市某某路 123 号'),
('agreement', '用户协议', '本协议是您与甜心蛋糕之间关于使用本服务所订立的协议。请仔细阅读。');

-- 福袋奖品
INSERT INTO `lottery_prize` (`name`, `type`, `value`, `weight`, `stock`, `total`, `status`) VALUES
('蛋糕券 50', 'coupon', 50, 5, 100, 100, 1),
('蛋糕券 20', 'coupon', 20, 10, 200, 200, 1),
('满减券', 'coupon', 0, 20, 500, 500, 1),
('100 积分', 'points', 100, 30, 9999, 9999, 1),
('50 积分', 'points', 50, 30, 9999, 9999, 1),
('谢谢参与', 'thanks', 0, 5, 9999, 9999, 1);

-- 员工账号 (密码: admin123, 用 BCrypt 加密的)
-- $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy = "admin123"
INSERT INTO `employee` (`username`, `password`, `name`, `phone`, `email`, `role`, `status`) VALUES
('admin',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '超级管理员', '13800000000', 'admin@cake.shop',    'super_admin', 1),
('operator', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '运营小王',   '13800000010', 'op@cake.shop',       'operator', 1),
('finance',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '财务小李',   '13800000020', 'finance@cake.shop',  'finance', 1);

-- 默认评价
INSERT INTO `review` (`user_id`, `goods_id`, `order_id`, `score`, `content`, `images`, `tags`, `status`, `reply`, `reply_time`) VALUES
(10001, 1, 100001, 5, '非常好吃!草莓很新鲜,奶油不腻,生日聚会大家都说好吃~', '[]', '好吃,新鲜,造型好看', 1, '感谢您的好评!我们将继续坚持品质 ❤', '2024-12-01 10:00:00'),
(10002, 2, 100002, 5, '巧克力熔岩切开后巧克力流出来,口感浓郁,孩子超喜欢!', '[]', '浓郁,孩子喜欢', 1, '谢谢支持~', '2024-12-02 14:30:00'),
(10001, 3, 100003, 4, '提拉米苏有点偏甜,不过整体不错', '[]', '偏甜', 1, '', NULL);

-- 风险规则 (示例)
INSERT INTO `risk_log` (`user_id`, `scenario`, `total_score`, `decision`, `factors`, `threshold`) VALUES
(0, 'init', 0, 'pass', '[]', '{"reject":80,"review":50}');


-- ===========================================

-- 第二轮 AUTO PATCH: create_by/update_by 全部补齐
ALTER TABLE `address` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `address` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `cart` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `cart` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `member_coupon` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `member_coupon` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `notice` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `notice` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `member` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `member` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `group_buy` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `group_buy` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `cms_page` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `cms_page` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `review` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `review` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `lottery_prize` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `lottery_prize` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `tenant` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `tenant` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `goods` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `goods` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `employee` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `employee` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `coupon` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `coupon` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `chat_message` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `chat_message` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `chat_session` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `chat_session` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `withdraw` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `withdraw` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `favorite` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `favorite` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `seckill` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `seckill` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `orders` ADD COLUMN `create_by` VARCHAR(50) DEFAULT '';
ALTER TABLE `orders` ADD COLUMN `update_by` VARCHAR(50) DEFAULT '';
