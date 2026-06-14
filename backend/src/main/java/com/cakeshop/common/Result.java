package com.cakeshop.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.io.Serializable;

/**
 * 统一响应体
 *   { code, msg, data, traceId }
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Result<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    private int code;
    private String msg;
    private T data;
    private String traceId;

    public static <T> Result<T> ok() { return ok(null); }
    public static <T> Result<T> ok(T data) { return build(ErrorCode.OK, data); }
    public static <T> Result<T> fail(ErrorCode ec) { return build(ec, null); }
    public static <T> Result<T> fail(ErrorCode ec, T data) { return build(ec, data); }
    public static <T> Result<T> fail(int code, String msg) {
        Result<T> r = new Result<>();
        r.code = code;
        r.msg = msg;
        return r;
    }

    private static <T> Result<T> build(ErrorCode ec, T data) {
        Result<T> r = new Result<>();
        r.code = ec.getCode();
        r.msg = ec.getMessage();
        r.data = data;
        return r;
    }

    public boolean isSuccess() { return this.code == ErrorCode.OK.getCode(); }
}
