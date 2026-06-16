# 后端启动 / 测试指南

> 本地无 MySQL 也想跑? 见末尾 [本地无 MySQL 用 H2 模式](#本地无-mysql-用-h2-模式)。

## 1. 准备数据库

```bash
# 启动 MariaDB / MySQL
sudo systemctl start mariadb   # 或 service mysql start

# 创建用户(可选, 你也可以用 root)
mysql -u root <<SQL
CREATE USER 'cake'@'localhost' IDENTIFIED BY 'cake123';
CREATE DATABASE cake_shop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL ON cake_shop.* TO 'cake'@'localhost';
FLUSH PRIVILEGES;
SQL

# 导入 schema
mysql -u cake -pcake123 cake_shop < src/main/resources/db/schema.sql
```

## 2. 启动后端

```bash
cd backend

# 方式 A: 直接 dev profile
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 方式 B: 打包 + jar
mvn -B -DskipTests package
java -jar target/cakeshop-backend.jar --spring.profiles.active=dev
```

启动成功日志:
```
Tomcat started on port(s): 8080 (http) with context path '/api'
Started CakeshopBackendApplication in 25.5 seconds
```

## 3. 真实接口测试

```bash
./scripts/test-api.sh
```

预期输出:
```
✅ 登录成功: eyJhbGciOiJIUzI1NiJ9...
✅ 商品列表 (200)
✅ 商品详情 (200)
... 12 项全过
==========================================
 ✅ 12 / ❌ 0
==========================================
```

## 4. 路径说明

> `server.servlet.context-path = /api`
> 大部分 controller 路径已含 `/api/v1/...` 或 `/api/...`
> **实际访问路径是双层 `/api/api/v1/...`**

| 用途 | 实际路径 |
|------|----------|
| 后台登录 | `POST /api/api/v1/auth/login` |
| 商品列表 | `GET /api/goods?page=1&size=10` |
| 公告 | `GET /api/api/v1/notice` |
| 健康检查 | `GET /api/actuator/health` |

## 5. 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | super_admin |
| operator | admin123 | operator |
| finance | admin123 | finance |

## 6. 常见问题

### 6.1 `Unknown column 'create_by' in 'SELECT'`
**原因**: schema.sql 没自动加 BaseEntity 字段
**解决**: schema.sql 末尾有 AUTO PATCH, 跑 schema 会自动补 `create_by` / `update_by` / `update_time` / `deleted` 字段

### 6.2 `Access denied for user 'root'@'localhost'`
**原因**: MariaDB 默认 root 用 unix_socket 认证
**解决**: 创建 `cake` 用户 + 密码 (见 1)

### 6.3 `DROP DATABASE IF EXISTS` 报错
**原因**: schema.sql 用了 H2 不支持的语法
**解决**: 已删除该行 (MySQL/MariaDB 不需要 DROP DATABASE, 直接用 `mysql` 命令覆盖库)

### 6.4 微信 code2session 报 `40013 invalid appid`
**原因**: dev 环境用了假 appid
**解决**: `application.yml` 设 `WX_APPID=真实appid` 和 `WX_SECRET=真实secret`
**生产环境**: 必须用真凭证, 否则 401

### 6.5 中文字段乱码
**原因**: JDBC URL 没设 `characterEncoding=UTF-8`
**解决**: `application-dev.yml` 已加 `characterEncoding=UTF-8&useUnicode=true`

---

## 本地无 MySQL 用 H2 模式

```bash
# 改 pom.xml
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>   <!-- 改回 runtime -->
</dependency>

# 改 application-dev.yml, url 改:
url: jdbc:h2:mem:cake_shop;DB_CLOSE_DELAY=-1;MODE=MySQL
driver-class-name: org.h2.Driver
```

> ⚠️ 实际 H2 schema 与 MySQL schema 略有差异 (注释 / `ON UPDATE` / `ENGINE=InnoDB` / `COMMENT` 等)
> 建议生产用真 MySQL, H2 只用于快速 demo

## 性能

- 启动时间: ~25 秒
- Bean 数: 540
- Controller: 40
- Service: 24
- 表数: 27
- jar 大小: ~110 MB (含所有依赖)
