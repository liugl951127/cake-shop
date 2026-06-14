package com.cakeshop.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 审计注解
 *   标注后 AuditAspect 自动记录
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    /** 操作,如 order.cancel / employee.changeRole */
    String action();
    /** 目标类型, order / goods / employee / tenant */
    String targetType();
    /** 目标 ID 参数名(从方法参数提取) */
    String targetArg() default "";
    /** 严重级别 info/warn/critical */
    String severity() default "info";
    /** 是否可回放(需要 before/after 快照) */
    boolean replayable() default false;
}
