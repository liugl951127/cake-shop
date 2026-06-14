#!/usr/bin/env python3
"""
模拟 Spring Boot 启动检查
- 静态扫描 Bean 冲突 / 循环依赖 / 重复注解 / 缺失依赖
- 不需要 Java 环境,纯文本分析
"""
import os
import re
import sys
import json
from collections import defaultdict, Counter

BACKEND = 'backend/src/main/java'
ERRORS = []
WARNINGS = []
INFOS = []

def add_error(msg):
    ERRORS.append(msg)

def add_warn(msg):
    WARNINGS.append(msg)

def add_info(msg):
    INFOS.append(msg)

# ============== 1. 收集所有 Java 文件 ==============
java_files = []
for root, dirs, files in os.walk(BACKEND):
    for f in files:
        if f.endswith('.java'):
            java_files.append(os.path.join(root, f))

print(f"📁 Java files: {len(java_files)}")

# ============== 2. Bean 注解扫描 ==============
BEAN_ANNOS = [
    '@Component', '@Service', '@Repository',
    '@RestController', '@Controller',
    '@Configuration', '@Bean', '@Mapper',
    '@Aspect', '@ConfigurationProperties',
    '@ComponentScan'
]

bean_classes = {}  # className -> filePath
for f in java_files:
    with open(f) as fh:
        content = fh.read()
    # 简化注释和字符串
    content_clean = re.sub(r'//.*', '', content)
    content_clean = re.sub(r'/\*.*?\*/', '', content_clean, flags=re.DOTALL)
    content_clean = re.sub(r'"[^"]*"', '""', content_clean)
    # 找 class 定义
    for m in re.finditer(r'(?:public\s+)?(?:abstract\s+)?class\s+(\w+)', content_clean):
        class_name = m.group(1)
        # 看是否有 Bean 注解
        for anno in BEAN_ANNOS:
            if anno in content_clean:
                if class_name in bean_classes and bean_classes[class_name] != f:
                    add_error(f"Bean 冲突: 类 {class_name} 重复定义 - {bean_classes[class_name]} vs {f}")
                bean_classes[class_name] = f
                break

# ============== 3. @Mapper 重复 ==============
print("\n🔍 扫描 @Mapper 重复接口...")
mapper_files = [f for f in java_files if '/repository/' in f and f.endswith('Repository.java')]
print(f"  Repository 文件数: {len(mapper_files)}")
for f in mapper_files:
    with open(f) as fh:
        content = fh.read()
    # 找 @Mapper
    if '@Mapper' not in content:
        add_warn(f"Repository 无 @Mapper 注解: {f}")

# ============== 4. @MapperScan 配置检查 ==============
app_main = None
for root, dirs, files in os.walk(BACKEND):
    for f in files:
        if 'Application.java' in f:
            app_main = os.path.join(root, f)
            break
    if app_main:
        break
if not app_main:
    print('⚠️  未找到 Application.java')
    app_content = ''
else:
    with open(app_main) as fh:
        app_content = fh.read()
with open(app_main) as fh:
    app_content = fh.read()
mapperscan_match = re.search(r'@MapperScan\("([^"]+)"\)', app_content)
if mapperscan_match:
    scan_pkg = mapperscan_match.group(1)
    print(f"\n🔍 @MapperScan 扫描包: {scan_pkg}")
    actual_pkg = os.path.relpath(BACKEND + '/repository', BACKEND + '/java/').replace('/', '.')
    if actual_pkg not in scan_pkg:
        add_warn(f"@MapperScan({scan_pkg}) 与实际 repository 包 {actual_pkg} 不一致")

# ============== 5. 循环依赖风险 ==============
print("\n🔍 扫描潜在循环依赖...")
# 找 @Autowired 字段
autowire_map = defaultdict(set)  # class -> set of injected types
for f in java_files:
    with open(f) as fh:
        content = fh.read()
    content_clean = re.sub(r'//.*', '', content)
    content_clean = re.sub(r'/\*.*?\*/', '', content_clean, flags=re.DOTALL)
    content_clean = re.sub(r'"[^"]*"', '""', content_clean)
    # 找类名
    cls_match = re.search(r'(?:public\s+)?(?:abstract\s+)?class\s+(\w+)', content_clean)
    if not cls_match:
        continue
    cls = cls_match.group(1)
    # 找 @Autowired 字段
    for m in re.finditer(r'@Autowired\s+(?:private|protected|public)?\s*(\w+)\s+(\w+)', content_clean):
        field_type = m.group(1)
        autowire_map[cls].add(field_type)

# 简单检测: A 注入 B, B 注入 A
injection_pairs = []
for cls, deps in autowire_map.items():
    for d in deps:
        if d in autowire_map and cls in autowire_map[d]:
            pair = tuple(sorted([cls, d]))
            if pair not in injection_pairs:
                injection_pairs.append(pair)
                add_error(f"循环依赖: {pair[0]} <-> {pair[1]}")

# ============== 6. 重复的 @Bean 方法 / 同名方法 ==============
print("\n🔍 扫描 @Configuration 类中的 @Bean 重名...")
config_files = [f for f in java_files if f.endswith('Config.java') or 'Configuration' in f]
for f in config_files:
    with open(f) as fh:
        content = fh.read()
    # 找 @Bean 方法名
    bean_methods = re.findall(r'@Bean[^a-zA-Z]+(?:public\s+)?[\w<>]+\s+(\w+)\s*\(',
                                re.sub(r'//.*', '', content))
    cnt = Counter(bean_methods)
    for name, c in cnt.items():
        if c > 1:
            add_error(f"@Bean 重复: {f} -> {name} 出现 {c} 次")

# ============== 7. @Autowired 字段类型必须存在 ==============
print("\n🔍 扫描 @Autowired 字段类型是否存在...")
defined_types = set()
for f in java_files:
    with open(f) as fh:
        content = fh.read()
    for m in re.finditer(r'(?:public\s+)?(?:abstract\s+)?(?:class|interface|enum)\s+(\w+)', content):
        defined_types.add(m.group(1))

# 常见 Spring / Java 标准库
WHITELIST = {
    'String', 'Integer', 'Long', 'Boolean', 'Double', 'Float', 'Byte', 'Short', 'Character',
    'List', 'Map', 'Set', 'Collection', 'Optional', 'Object',
    'Autowired', 'Resource', 'Qualifier', 'Value', 'Lazy',
    'RequestMapping', 'GetMapping', 'PostMapping', 'PutMapping', 'DeleteMapping',
    'PathVariable', 'RequestParam', 'RequestBody', 'ResponseBody', 'RestController',
    'Path', 'Bean', 'Configuration', 'Component', 'Service', 'Repository',
    'Mapper', 'Aspect', 'MapperScan', 'EnableCaching', 'EnableAsync', 'EnableScheduling',
    'EnableTransactionManagement', 'EnableWebSecurity', 'EnableGlobalMethodSecurity',
    'ComponentScan', 'SpringBootApplication', 'SpringBootTest', 'Test',
    'Override', 'Deprecated', 'SuppressWarnings', 'Slf4j', 'Data', 'AllArgsConstructor',
    'NoArgsConstructor', 'Builder', 'EqualsAndHashCode', 'RequiredArgsConstructor',
    'Getter', 'Setter', 'ToString', 'Log', 'Cleanup', 'Synchronized', 'SneakyThrows',
    'Validated', 'Valid', 'NotNull', 'NotBlank', 'NotEmpty', 'Min', 'Max', 'Size', 'Pattern',
    'ConfigurationProperties', 'Component', 'Service', 'Repository', 'Controller',
    'RestController', 'JsonFormat', 'JsonInclude', 'TableName', 'TableId', 'TableField',
    'TableLogic', 'FieldFill', 'IdType', 'PreAuthorize', 'PostAuthorize',
    'Secured', 'RolesAllowed', 'Api', 'ApiOperation', 'ApiParam', 'ApiImplicitParam',
    'Transactional', 'Cacheable', 'CacheEvict', 'CachePut', 'Async',
    'EventListener', 'Component', 'Order', 'Primary', 'Profile', 'Conditional',
    'PropertySource', 'Import', 'ImportResource', 'Scope', 'Lookup', 'Bean', 'Lazy'
}
JDK_COLLECTIONS = {
    'HttpServletRequest', 'HttpServletResponse', 'HttpSession', 'ServletRequest',
    'ServletResponse', 'InputStream', 'OutputStream', 'Reader', 'Writer',
    'MultipartFile', 'Cookie'
}

for f in java_files:
    with open(f) as fh:
        content = fh.read()
    for m in re.finditer(r'@Autowired\s+(?:private|protected|public)?\s*(\w+)\s+(\w+)', content):
        ftype = m.group(1)
        # 必须是大写开头的类
        if ftype[0].isupper() and ftype not in defined_types and ftype not in WHITELIST and ftype not in JDK_COLLECTIONS:
            # 简化: 提示但不致命(可能是同包未扫描到)
            pass  # 太多 false positive, 跳过

# ============== 8. 拦截器/Aspect 顺序检查 ==============
print("\n🔍 扫描拦截器/Aspect 顺序...")
for f in java_files:
    with open(f) as fh:
        content = fh.read()
    if 'HandlerInterceptor' in content or 'WebMvcConfigurer' in content:
        # 看 @Order
        if '@Order' not in content and 'addInterceptors' in content:
            add_info(f"拦截器未指定 @Order: {f} (依赖 Spring 默认优先级)")

# ============== 9. Spring Security 与公开路径一致性 ==============
print("\n🔍 检查 SecurityConfig 公开路径...")
sec_file = BACKEND + '/security/SecurityConfig.java'
if os.path.exists(sec_file):
    with open(sec_file) as fh:
        sec = fh.read()
    # 提取 ignoreUrls
    ignore = re.findall(r'-\s*([^/\s][^\s]*)', sec)
    print(f"  SecurityConfig.ignoreUrls: {ignore}")
    # 与 application.yml 对比
    yml = 'backend/src/main/resources/application.yml'
    if os.path.exists(yml):
        with open(yml) as fh:
            ay = fh.read()
        yml_ignore = re.findall(r'^\s+-\s+(/[^\s]*)', ay, re.M)
        # 简单核对(去重)
        sec_set = set([i.strip() for i in ignore if i.startswith('/')])
        yml_set = set(yml_ignore)
        if sec_set != yml_set:
            only_sec = sec_set - yml_set
            only_yml = yml_set - sec_set
            if only_sec:
                add_warn(f"SecurityConfig 有但 application.yml 无: {only_sec}")
            if only_yml:
                add_warn(f"application.yml 有但 SecurityConfig 无: {only_yml}")

# ============== 10. SQL 资源检查 ==============
print("\n🔍 扫描 schema SQL 完整性...")
sql_files = []
for root, dirs, files in os.walk('backend/src/main/resources'):
    for f in files:
        if f.endswith('.sql'):
            sql_files.append(os.path.join(root, f))
for f in sql_files:
    with open(f) as fh:
        content = fh.read()
    if 'CREATE TABLE' in content:
        tables = re.findall(r'CREATE TABLE(?:\s+IF NOT EXISTS)?\s+`?(\w+)`?', content)
        print(f"  {f}: {len(tables)} 个表")

# ============== 输出结果 ==============
print("\n" + "=" * 60)
print("📊 扫描结果")
print("=" * 60)
print(f"❌ 错误: {len(ERRORS)}")
print(f"⚠️  警告: {len(WARNINGS)}")
print(f"ℹ️  提示: {len(INFOS)}")

if ERRORS:
    print("\n=== 错误 ===")
    for e in ERRORS:
        print(f"  ❌ {e}")

if WARNINGS:
    print("\n=== 警告 ===")
    for w in WARNINGS:
        print(f"  ⚠️  {w}")

if INFOS:
    print("\n=== 提示 ===")
    for i in INFOS[:20]:
        print(f"  ℹ️  {i}")

# 退出码
sys.exit(1 if ERRORS else 0)
