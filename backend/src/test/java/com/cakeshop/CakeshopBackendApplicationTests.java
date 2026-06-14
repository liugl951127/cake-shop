package com.cakeshop;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import com.cakeshop.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 启动测试:用 H2 + mock Redis
 * 不连接真实 MySQL/Redis,只验证 Bean 装配 + 基础功能
 */
@SpringBootTest
@ActiveProfiles("test")
class CakeshopBackendApplicationTests {

    @Autowired private JwtUtil jwtUtil;

    // Mock 掉 Redis,不让它真连
    @MockBean private StringRedisTemplate stringRedisTemplate;

    @Test
    void contextLoads() {
        // 关键:ApplicationContext 能起来 = 所有 Bean 装配成功
    }

    @Test
    void jwtRoundTrip() {
        String token = jwtUtil.generate(1001L, "test_openid", "admin", true);
        assertNotNull(token);
        var claims = jwtUtil.parse(token);
        assertNotNull(claims);
        assertEquals("test_openid", claims.get("openid"));
    }

    @Test
    void errorCodeMapping() {
        assertEquals(0, ErrorCode.OK.getCode());
        assertEquals(2001, ErrorCode.ORDER_NOT_FOUND.getCode());
        assertEquals(4801, ErrorCode.WECOM_CONFIG_MISSING.getCode());
        assertEquals(5001, ErrorCode.SESSION_ALREADY_CLOSED.getCode());
    }

    @Test
    void bizExceptionBuildsCorrectCode() {
        BizException e = new BizException(ErrorCode.OUT_OF_STOCK, "蛋糕 缺货");
        assertEquals(ErrorCode.OUT_OF_STOCK.getCode(), e.getCode());
        assertEquals("蛋糕 缺货", e.getMessage());
    }

    @Test
    void resultOkHasZeroCode() {
        Result<String> r = Result.ok("hi");
        assertEquals(0, r.getCode());
        assertEquals("hi", r.getData());
        assertTrue(r.isSuccess());
    }
}
