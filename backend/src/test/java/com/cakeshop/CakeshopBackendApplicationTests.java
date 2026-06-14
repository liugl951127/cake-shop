package com.cakeshop;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import com.cakeshop.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 启动 + JWT + 错误码基础测试
 */
@SpringBootTest
class CakeshopBackendApplicationTests {

    @Autowired
    private JwtUtil jwtUtil;

    @Test
    void contextLoads() {
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
