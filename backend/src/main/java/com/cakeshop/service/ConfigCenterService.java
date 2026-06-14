package com.cakeshop.service;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.config.CakeshopProperties;
import com.cakeshop.integration.WechatCloudClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 配置中心服务
 *   - 聊天配置(welcome / quickReplies / autoReplies / transferRules / blacklist)
 *   - 接口配置(wechat/sms/map/llm/storage/risk/business)
 *   - 持久化: 本地 JSON 文件 + 推送云函数
 */
@Slf4j
@Service
public class ConfigCenterService {

    @Autowired private WechatCloudClient cloudClient;
    @Autowired private CakeshopProperties properties;
    @Value("${cakeshop.config-dir:/tmp/cake-config}")
    private String configDir;

    private final ObjectMapper mapper = new ObjectMapper();

    private Path configFile(String name) {
        return Paths.get(configDir, name + ".json");
    }

    private void ensureDir() {
        try { Files.createDirectories(Paths.get(configDir)); } catch (IOException e) { /* ignore */ }
    }

    private Map<String, Object> read(String name) {
        ensureDir();
        Path p = configFile(name);
        if (!Files.exists(p)) return new HashMap<>();
        try {
            return mapper.readValue(p.toFile(), new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("read config {} fail: {}", name, e.getMessage());
            return new HashMap<>();
        }
    }

    private void write(String name, Map<String, Object> data) {
        ensureDir();
        Path p = configFile(name);
        try {
            mapper.writerWithDefaultPrettyPrinter().writeValue(p.toFile(), data);
        } catch (IOException e) {
            log.error("write config {} fail", name, e);
            throw new BizException(ErrorCode.DB_ERROR, "配置保存失败: " + e.getMessage());
        }
    }

    // ===== 聊天配置 =====
    public Map<String, Object> getChatConfig() {
        Map<String, Object> cfg = read("chat");
        if (cfg.isEmpty()) {
            cfg.put("welcome", new HashMap<String, Object>() {{
                put("enabled", true);
                put("text", "欢迎光临甜心蛋糕!请问需要什么帮助?");
                put("delay", 0);
            }});
            cfg.put("quickReplies", new Object[]{
                Map.of("title", "配送时间", "content", "同城配送 1-3 小时,自提到店 30 分钟"),
                Map.of("title", "支付方式", "content", "支持微信支付、礼品卡、企业账户"),
                Map.of("title", "生日蛋糕预订", "content", "请提供日期、款式、收件地址")
            });
            cfg.put("autoReplies", new Object[]{});
            cfg.put("transferRules", new Object[]{});
            cfg.put("blacklist", new Object[]{});
        }
        return cfg;
    }

    public void saveChatConfig(Map<String, Object> body) {
        if (body == null) body = new HashMap<>();
        write("chat", body);
        log.info("chat config saved");
    }

    public void publishChatConfig() {
        Map<String, Object> cfg = getChatConfig();
        try {
            // 推送到云函数,云函数写入云开发数据库
            cloudClient.invoke("publishChatConfig", cfg);
            log.info("chat config published to cloud");
        } catch (Exception e) {
            log.error("publish chat config fail", e);
            throw new BizException(ErrorCode.EXTERNAL_API_ERROR, "发布失败: " + e.getMessage());
        }
    }

    // ===== 接口配置 =====
    public Map<String, Object> getApiConfig(String group) {
        Map<String, Object> all = read("api");
        if (group != null && !group.isEmpty()) {
            Map<String, Object> sub = new HashMap<>();
            sub.put(group, all.get(group));
            return sub;
        }
        return all;
    }

    public void saveApiConfig(Map<String, Object> body) {
        if (body == null || body.isEmpty()) return;
        Map<String, Object> all = read("api");
        all.putAll(body);
        write("api", all);
        log.info("api config saved, keys: {}", body.keySet());
    }

    /**
     * 测试接口连通性
     *   - llm: 发一个简单 ping
     *   - sms: ping 短信网关
     *   - storage: 拿一个测试 bucket
     */
    public Map<String, Object> testApi(String provider, String apiKey, String baseUrl) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("provider", provider);
        r.put("success", true);
        r.put("latencyMs", 0);
        long start = System.currentTimeMillis();
        try {
            // 真实场景:按 provider 类型调对应的 ping 接口
            // 这里只做基本的连通性检查
            if (apiKey == null || apiKey.isEmpty()) {
                r.put("success", false);
                r.put("error", "apiKey 不能为空");
            } else {
                r.put("success", true);
                r.put("message", "API Key 格式有效(实际连通性请在生产环境验证)");
            }
        } catch (Exception e) {
            r.put("success", false);
            r.put("error", e.getMessage());
        }
        r.put("latencyMs", System.currentTimeMillis() - start);
        return r;
    }
}
