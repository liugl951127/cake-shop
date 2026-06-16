package com.cakeshop.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.io.Serializable;

/**
 * 统一返回结构
 *   { "code": 0, "msg": "ok", "data": ... }
 *
 * code 0 = 成功
 * code > 0 = 业务错误 (见 ErrorCode)
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class R<T> implements Serializable {
    private Integer code;
    private String msg;
    private T data;

    public static <T> R<T> ok() { return ok(null); }

    public static <T> R<T> ok(T data) {
        R<T> r = new R<>();
        r.code = 0;
        r.msg = "ok";
        r.data = data;
        return r;
    }

    public static <T> R<T> error(int code, String msg) {
        R<T> r = new R<>();
        r.code = code;
        r.msg = msg;
        return r;
    }

    public static <T> R<T> error(ErrorCode ec, String msg) {
        R<T> r = new R<>();
        r.code = ec.getCode();
        r.msg = msg != null ? msg : ec.getMessage();
        return r;
    }
}
