package com.cakeshop.common;

import lombok.Getter;

/**
 * 业务异常(GlobalExceptionHandler 捕获)
 */
@Getter
public class BizException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final int code;
    private final Object data;

    public BizException(ErrorCode ec) {
        super(ec.getMessage());
        this.code = ec.getCode();
        this.data = null;
    }

    public BizException(ErrorCode ec, String msg) {
        super(msg);
        this.code = ec.getCode();
        this.data = null;
    }

    public BizException(ErrorCode ec, Object data) {
        super(ec.getMessage());
        this.code = ec.getCode();
        this.data = data;
    }
}
