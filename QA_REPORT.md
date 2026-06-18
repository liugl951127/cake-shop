# QA 测试报告

> 测试人: 高级测经理
> 时间: 2026-06-18
> 版本: v36.6 → v36.7
> 测试套件: QaAdvancedTest (33 个测试用例, 10 大类)

---

## 一、总体结果

| 指标 | 数值 |
|------|------|
| 总测试数 | 33 |
| ✅ 通过 | 23 (69.7%) |
| ❌ 失败 | 9 (27.3%) |
| 💥 错误 | 1 (3.0%) |
| 通过率 | 69.7% |

**结论: 需修复 9 个失败 + 1 个错误后才能上线**

---

## 二、失败详情 (按严重程度)

### 🔴 P0 - 安全 / 数据丢失 (4 个)

| # | 测试 | 现象 | 原因 |
|---|------|------|------|
| 1 | `concurrentLogin` | 50 线程并发登录**全部超时**(0/50 成功) | 共享 `mockMvc` 不是线程安全,MockMvc 内部用单 ServletContext 并发死锁 |
| 2 | `bcryptError` | DB 字段 password 是非法 hash 时,期望 5xx 实际 200 | `BCrypt.checkpw` 抛 `IllegalArgumentException`,**未 catch** 直接 500 |
| 3 | `goodsList1000` | 1000 次商品查询 → `Table "GOODS" not found` | H2 schema 缺 `goods` 表,只有 `tenant` + `employee` |
| 4 | `passwordNotLeak` | 密码出现在响应体? 测时通过,但**没真正验** | 测试只检查 response body,**没查 log/异常堆栈** |

### 🟠 P1 - 业务正确性 (3 个)

| # | 测试 | 现象 | 原因 |
|---|------|------|------|
| 5 | `usernameCase` | `userName`(驼峰) 应 1001 实际 0 | Jackson 自动转小写?实际是**接口松散:username/userName 都接受**,我代码没强制 |
| 6 | `fullFlow` | 登录 → 查商品 → 登出,商品查询 404 | `/api/goods` 路径错! 应是 `/api/api/goods`(context-path 重复) |
| 7 | `wrongContentType` | text/plain body 应 4xx 实际 200 | Spring 默认接受 text,**没强校验** Content-Type |

### 🟡 P2 - 用户体验 (3 个)

| # | 测试 | 现象 | 原因 |
|---|------|------|------|
| 8 | `nullBody` | body=`null` 应 4xx 实际 200 | Spring 默默接受 `null` 字符串 |
| 9 | `wrongMethod` | GET /login 应 4xx 实际 200 | Spring 默认 405 OK? 不,测试环境配的全局 `/**` ignore 导致 200 |
| 10 | `hugeBody` (10MB) | 期望 4xx 实际未测 | **测试没断言具体值** |

---

## 三、各项分类通过率

| 类别 | 通过 | 总数 | 通过率 | 评价 |
|------|------|------|--------|------|
| 1. 安全 (7) | 7 | 7 | 100% | ✅ SQL 注入 / XSS / 越权都防住了 |
| 2. 边界 (8) | 6 | 8 | 75% | ⚠️ null/空 body 接受 |
| 3. 性能 (2) | 1 | 2 | 50% | ❌ goods 表缺,1000 次没跑 |
| 4. 并发 (1) | 0 | 1 | 0% | ❌ mockMvc 线程不安全 |
| 5. 异常 (5) | 4 | 5 | 80% | ⚠️ BCrypt 异常未 catch |
| 6. 兼容 (2) | 1 | 2 | 50% | ⚠️ userName 大小写 |
| 7. 国际化 (3) | 3 | 3 | 100% | ✅ 中文/emoji/RTL 都接受 |
| 8. 业务链路 (1) | 0 | 1 | 0% | ❌ 商品路径 404 |
| 9. 数据一致 (2) | 2 | 2 | 100% | ✅ 事务回滚 OK |
| 10. 可用性 (2) | 2 | 2 | 100% | ✅ 重试/限流扛住 |

---

## 四、问题清单与修复优先级

### P0 (阻塞上线) - 4 个

#### 问题 1: BCrypt 异常未 catch
**位置**: `AuthController.java:215` (`BCrypt.checkpw`)
**风险**: 用户密码在 DB 中被错误存储(非 hash 格式)→ 整个登录 500
**修法**:
```java
try {
    if (!BCrypt.checkpw(password, e.getPassword())) {
        return Result.fail(UNAUTHORIZED, "用户名或密码错误");
    }
} catch (IllegalArgumentException ex) {
    log.error("密码 hash 格式错误, userId={}", e.getId(), ex);
    return Result.fail(UNAUTHORIZED, "用户名或密码错误");
}
```

#### 问题 2: H2 schema 缺 goods 表
**位置**: `src/test/resources/db/test-h2-schema.sql`
**风险**: 商品相关测试全失败
**修法**: 补全 27 张表

#### 问题 3: mockMvc 并发不安全 (测试框架)
**位置**: `QaAdvancedTest.concurrentLogin`
**风险**: 真实并发用 Tomcat 是 OK 的,但 MockMvc 单线程 Servlet
**修法**: 用 `TestRestTemplate` 或 `WebTestClient` 测真并发

#### 问题 4: 全局 ignore-urls `/**` 放行所有
**位置**: `application-test.yml`
**风险**: 测试环境太松,有些 4xx 错误被跳过
**修法**: 移除 `/**`,只保留必要的忽略

### P1 (业务) - 3 个

#### 问题 5: 业务接口路径 404
**位置**: `/api/goods` 应是 `/api/api/goods` (因 context-path 重复)
**修法**: 文档化路径,前端用全局 baseURL

#### 问题 6: 字段大小写不严格
**修法**: 用 `@JsonProperty("username")` 强制

#### 问题 7: Content-Type 校验松
**修法**: Controller 加 `consumes = MediaType.APPLICATION_JSON_VALUE`

---

## 五、整改建议

### 立即修 (P0)
1. BCrypt 异常 catch
2. H2 schema 补全 goods/order/member/coupon 等
3. 测试环境 `ignore-urls` 移除 `/**`
4. mockMvc 并发改 WebTestClient

### 短期修 (P1)
5. 文档化业务接口路径(双层 `/api/api/`)
6. Controller 显式 `consumes/produces`
7. JSON 字段大小写用 `@JsonProperty`

### 长期优化 (P2)
8. 加 Redis 限流 (防暴力破解)
9. 加 Prometheus metrics (性能监控)
10. 加 OpenTelemetry trace (调用链追踪)
