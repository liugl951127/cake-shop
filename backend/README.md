# 甜心蛋糕 - Spring Boot 后台

商家管理后台,JDK 1.8 + Spring Boot 2.7.18 + MyBatis-Plus 3.5.5 + Spring Security 5.x。

## 技术栈

| 组件 | 版本 |
|------|------|
| JDK | 1.8+ |
| Spring Boot | 2.7.18 |
| Spring Security | 5.7.x |
| MyBatis-Plus | 3.5.5 |
| MySQL | 8.0+ |
| Redis | 5.x+ |
| JJWT | 0.11.5 |
| Knife4j | 4.4.0 |
| Druid | 1.2.20 |
| Redisson | 3.27.0 |
| MinIO | 8.5.10 |
| EasyExcel | 3.3.3 |

## Maven 镜像

`pom.xml` 已配置 **阿里云** 镜像(主) + 中心(兜底),无需修改 settings.xml:

- aliyun-public: https://maven.aliyun.com/repository/public
- aliyun-spring: https://maven.aliyun.com/repository/spring
- aliyun-spring-plugin: https://maven.aliyun.com/repository/spring-plugin
- central: https://repo1.maven.org/maven2/

## 快速开始

```bash
# 1. 初始化数据库
mysql -uroot -p < src/main/resources/schema.sql

# 2. 启动
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 3. 访问
http://localhost:8080/api/doc.html         # Knife4j API 文档
http://localhost:8080/api/auth/login       # 登录
# { "phone": "admin", "password": "123456" }
```

## 模块

```
src/main/java/com/cakeshop/
├── CakeshopBackendApplication.java       # 启动类
├── config/                                # 配置
│   ├── CakeshopProperties.java            # 自定义配置
│   ├── MybatisPlusConfig.java             # 分页 + 乐观锁
│   ├── MybatisMetaHandler.java            # 自动填充
│   └── SwaggerConfig.java                 # API 文档
├── common/                                # 公共
│   ├── ErrorCode.java                     # 错误码
│   ├── Result.java                        # 统一响应
│   └── BizException.java                  # 业务异常
├── entity/                                # 实体
│   ├── BaseEntity.java
│   ├── Employee.java
│   ├── Order.java
│   ├── Goods.java
│   ├── RiskLog.java
│   └── AuditLog.java
├── repository/                            # MyBatis-Plus Mapper
│   ├── EmployeeRepository.java
│   ├── OrderRepository.java
│   ├── GoodsRepository.java
│   ├── RiskLogRepository.java
│   └── AuditLogRepository.java
├── service/                               # 业务
│   ├── EmployeeService.java
│   ├── OrderService.java
│   ├── GoodsService.java
│   └── RiskReviewService.java
├── controller/                            # REST API
│   ├── AuthController.java                # 鉴权
│   ├── EmployeeController.java            # 员工
│   ├── OrderController.java               # 订单
│   ├── GoodsController.java               # 商品
│   └── RiskController.java                # 风控
├── security/                              # 安全
│   ├── JwtUtil.java
│   ├── JwtAuthFilter.java
│   ├── LoginUser.java
│   └── SecurityConfig.java
├── exception/
│   └── GlobalExceptionHandler.java        # 全局异常
└── integration/
    └── WechatCloudClient.java             # 调小程序云函数
```

## RBAC 角色

| 角色 | 权限 |
|------|------|
| `super_admin` | 所有权限 |
| `admin` | 订单/商品/用户/营销/财务(读) |
| `operator` | 商品/订单(读)/营销/用户(读) |
| `finance` | 财务/订单(读) |
| `customer_service` | 客服/用户(读)/订单(读) |
| `readonly` | 只读 |

通过 `@PreAuthorize("hasAnyRole('...')")` 注解在方法上做权限校验。

## API 文档

启动后访问:
- `http://localhost:8080/api/doc.html` - Knife4j 增强 UI
- `http://localhost:8080/api/v2/api-docs` - Swagger JSON

## 集成微信云函数

`WechatCloudClient.invoke(fnName, data)` - 调小程序的云函数,适合:
- 支付回调触发(给云函数发通知)
- 跨端数据同步
- 统一发券/发短信

## 错误码

| 码 | 含义 |
|------|------|
| 0 | OK |
| -1 | FAIL |
| 1001 | 参数错误 |
| 1002 | 未登录 |
| 1003 | token 失效 |
| 1004 | 无权限 |
| 1010 | 库存不足 |
| 1012 | 风控拦截 |
| 2001 | 订单不存在 |
| 2002 | 订单状态错误 |
| 5000 | 系统异常 |
| 5003 | 外部服务异常 |
| ... | 详见 `ErrorCode.java` |

## 部署

```bash
mvn clean package -DskipTests
java -jar target/cakeshop-backend.jar --spring.profiles.active=prod
```

Docker:
```dockerfile
FROM openjdk:8-jre
COPY target/cakeshop-backend.jar /app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]
```
