package com.cakeshop.exception;

import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.common.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import javax.servlet.http.HttpServletRequest;
import javax.validation.ConstraintViolation;
import javax.validation.ConstraintViolationException;
import java.util.stream.Collectors;

/**
 * 全局异常处理
 *  - BizException     -> 业务异常(自定义码)
 *  - 校验异常         -> 1001 + 字段错误
 *  - AccessDenied     -> 403
 *  - Authentication   -> 401
 *  - 兜底             -> 5000
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BizException.class)
    public Result<Void> handleBiz(BizException e, HttpServletRequest req) {
        log.warn("[BizException] {} {} -> {} {}", req.getMethod(), req.getRequestURI(), e.getCode(), e.getMessage());
        Result<Void> r = new Result<>();
        r.setCode(e.getCode());
        r.setMsg(e.getMessage());
        return r;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValid(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
            .map(fe -> fe.getField() + ":" + fe.getDefaultMessage())
            .collect(Collectors.joining(","));
        log.warn("[Validation] {}", msg);
        Result<Void> r = new Result<>();
        r.setCode(ErrorCode.BAD_REQUEST.getCode());
        r.setMsg(msg);
        return r;
    }

    @ExceptionHandler(BindException.class)
    public Result<Void> handleBind(BindException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining(","));
        Result<Void> r = new Result<>();
        r.setCode(ErrorCode.BAD_REQUEST.getCode());
        r.setMsg(msg);
        return r;
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public Result<Void> handleConstraint(ConstraintViolationException e) {
        String msg = e.getConstraintViolations().stream()
            .map(ConstraintViolation::getMessage)
            .collect(Collectors.joining(","));
        Result<Void> r = new Result<>();
        r.setCode(ErrorCode.BAD_REQUEST.getCode());
        r.setMsg(msg);
        return r;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Result<Void>> handleAccess(AccessDeniedException e) {
        Result<Void> r = new Result<>();
        r.setCode(ErrorCode.FORBIDDEN.getCode());
        r.setMsg(ErrorCode.FORBIDDEN.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(r);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Result<Void>> handleAuth(AuthenticationException e) {
        Result<Void> r = new Result<>();
        r.setCode(ErrorCode.UNAUTHORIZED.getCode());
        r.setMsg(ErrorCode.UNAUTHORIZED.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(r);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public Result<Void> handleIllegal(IllegalArgumentException e) {
        Result<Void> r = new Result<>();
        r.setCode(ErrorCode.BAD_REQUEST.getCode());
        r.setMsg(e.getMessage());
        return r;
    }

    @ExceptionHandler(Exception.class)
    public Result<Void> handleAll(Exception e, HttpServletRequest req) {
        log.error("[Unhandled] {} {}", req.getMethod(), req.getRequestURI(), e);
        Result<Void> r = new Result<>();
        r.setCode(ErrorCode.SYSTEM_ERROR.getCode());
        r.setMsg(e.getMessage());
        return r;
    }
}
