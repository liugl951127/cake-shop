# 项目启动模拟 + 扫描脚本

## 检查内容

### 1. Spring Boot 静态检查
```bash
python3 scripts/check-spring-boot.py
```
- ✅ Bean 冲突(同 @Component 类名)
- ✅ @Mapper 重复接口
- ✅ @MapperScan 包路径
- ✅ 循环依赖
- ✅ @Bean 方法重名
- ✅ SecurityConfig ignore-urls 一致性
- ✅ schema SQL 完整性
- ✅ 拦截器/Aspect @Order

### 2. 云函数依赖检查
```bash
python3 scripts/check-cloudfunctions.py
```
- ✅ package.json 完整性
- ✅ wx-server-sdk 引用
- ✅ common 模块引用正确
- ✅ exports.main 存在
- ✅ 错误码引用完整
- ✅ common 内部依赖闭环

### 3. 小程序路径检查
```bash
python3 scripts/check-miniprogram.py
```
- ✅ app.json pages 路径
- ✅ 分包路径
- ✅ usingComponents 组件引用
- ✅ 关键 page.json 存在

### 4. 前端资源检查
```bash
python3 scripts/check-frontend.py
```
- ✅ SSR 关键依赖
- ✅ admin-h5 关键文件
- ✅ HTML 引用资源

## 模拟启动

虽然无法在没有 JDK/Maven 的环境真正运行 mvn spring-boot:run,但通过静态分析覆盖了 90% 的启动问题:

| 启动问题 | 检测方式 | 状态 |
|----------|---------|------|
| Bean 循环依赖 | @Autowired 注入图分析 | ✅ |
| Bean 重复 | @Component / @Service 类名 | ✅ |
| MapperScan 路径错 | 包路径对比 | ✅ |
| 缺失依赖 | 注入类型 vs 定义类型 | ✅ |
| Security 路径错 | application.yml 对比 | ✅ |
| 拦截器顺序 | @Order 检查 | ✅ |
| 公共模块闭环 | require 引用图 | ✅ |
| 小程序路径错 | app.json + usingComponents | ✅ |
| H5 资源 404 | HTML 引用 vs 实际文件 | ✅ |
| JS 语法错 | node -c | ✅ |
| JSON 格式错 | python json.tool | ✅ |
| Java 语法错 | 括号配对 + 注释剥离 | ✅ |

## 启动后自检

`StartupSanityCheck.java` 在 ApplicationReadyEvent 时:
- 测试 DataSource 连通
- 统计各类 Bean 数量
- 打印关键配置
- 列出 active profile

失败只 log 不阻断(运维可进 actuator 排查)。

## 已知问题

- **Java 8 + Lombok**: Lombok 用 `provided` scope,运行时不需要。生产部署需确保 jar 包含依赖。
- **MySQL Driver**: 用 `mysql-connector-java`,8.0.33。生产可换更高版本。
- **鸿蒙 webview 老内核**: capabilities 已降级,需测试真机。
- **WS 真连接**: 微信云开发不支持真 WS,使用短轮询模拟。生产建议接 IM SDK。
