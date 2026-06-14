package com.cakeshop.integration;

import com.alibaba.fastjson2.JSON;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.config.CakeshopProperties;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * 微信云函数 HTTP 调用客户端
 *   - 用于从 Spring Boot 后台调小程序的云函数(如统一发支付短信、退款)
 *   - 调用地址: https://{env}.ap-shanghai.tcb-api.tencentcloud.com
 *   - 鉴权: 走 access_token(略,真实项目应该用稳定 access_token)
 *
 * 注意: 真实场景需使用 server-sdk 调用 wx.cloud.callFunction,这里模拟
 */
@Slf4j
@Component
public class WechatCloudClient {

    @Autowired private CakeshopProperties properties;

    private final CloseableHttpClient http = HttpClients.createDefault();

    public Map<String, Object> invoke(String fnName, Map<String, Object> data) {
        try {
            String url = properties.getWechat().getCloudbase().getApiBase() + "/" + fnName;
            HttpPost post = new HttpPost(url);
            post.setHeader("Content-Type", "application/json;charset=UTF-8");
            post.setEntity(new StringEntity(JSON.toJSONString(data), StandardCharsets.UTF_8));
            RequestConfig cfg = RequestConfig.custom()
                .setConnectTimeout(properties.getWechat().getCloudbase().getTimeoutMs())
                .setSocketTimeout(properties.getWechat().getCloudbase().getTimeoutMs())
                .build();
            post.setConfig(cfg);

            try (CloseableHttpResponse resp = http.execute(post)) {
                String body = EntityUtils.toString(resp.getEntity(), StandardCharsets.UTF_8);
                int code = resp.getStatusLine().getStatusCode();
                if (code != 200) {
                    log.error("[WechatCloud] {} status={} body={}", fnName, code, body);
                    throw new BizException(ErrorCode.EXTERNAL_API_ERROR, "云函数 " + fnName + " 调用失败");
                }
                return JSON.parseObject(body, Map.class);
            }
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("[WechatCloud] invoke {} error", fnName, e);
            throw new BizException(ErrorCode.EXTERNAL_API_ERROR, "云函数调用异常: " + e.getMessage());
        }
    }
}
