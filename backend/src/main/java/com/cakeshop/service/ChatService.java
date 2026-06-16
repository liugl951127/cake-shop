package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.common.BizException;
import com.cakeshop.common.ErrorCode;
import com.cakeshop.entity.ChatMessage;
import com.cakeshop.entity.ChatSession;
import com.cakeshop.repository.ChatMessageRepository;
import com.cakeshop.repository.ChatSessionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class ChatService extends ServiceImpl<ChatSessionRepository, ChatSession> {

    @Autowired private ChatMessageRepository messageRepository;

    public ChatSession getOrCreateSession(Long userId, String type) {
        if (userId == null) throw new BizException(ErrorCode.BAD_REQUEST, "userId 必填");
        ChatSession s = lambdaQuery().eq(ChatSession::getUserId, userId)
            .ne(ChatSession::getStatus, "closed")
            .orderByDesc(ChatSession::getCreateTime)
            .last("LIMIT 1").one();
        if (s == null) {
            s = new ChatSession();
            s.setUserId(userId);
            s.setStatus("ai");
            s.setType(type != null ? type : "service");
            s.setUnreadUser(0);
            s.setUnreadAgent(0);
            s.setCreateTime(LocalDateTime.now());
            s.setUpdateTime(LocalDateTime.now());
            save(s);
        }
        return s;
    }

    @Transactional(rollbackFor = Exception.class)
    public ChatMessage sendMessage(Long sessionId, String from, String type, String content) {
        if (sessionId == null || from == null) {
            throw new BizException(ErrorCode.BAD_REQUEST, "参数错误");
        }
        ChatMessage m = new ChatMessage();
        m.setSessionId(sessionId);
        m.setFromSide(from);
        m.setMsgType(type != null ? type : "text");
        m.setContent(content != null ? content : "");
        m.setCreateTime(LocalDateTime.now());
        messageRepository.insert(m);

        ChatSession s = getById(sessionId);
        if (s != null) {
            s.setLastMsg(content != null && content.length() > 200 ? content.substring(0, 200) : content);
            s.setLastMsgTime(LocalDateTime.now());
            if ("user".equals(from)) {
                s.setUnreadAgent((s.getUnreadAgent() == null ? 0 : s.getUnreadAgent()) + 1);
            } else if ("agent".equals(from)) {
                s.setUnreadUser((s.getUnreadUser() == null ? 0 : s.getUnreadUser()) + 1);
            }
            s.setUpdateTime(LocalDateTime.now());
            updateById(s);
        }
        return m;
    }

    public List<ChatMessage> getMessages(Long sessionId, Integer page, Integer size) {
        if (page == null || page < 1) page = 1;
        if (size == null || size < 1) size = 20;
        return messageRepository.selectList(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<ChatMessage>()
            .eq("session_id", sessionId)
            .orderByAsc("create_time")
            .last("LIMIT " + (page - 1) * size + "," + size));
    }

    public void closeSession(Long sessionId) {
        ChatSession s = new ChatSession();
        s.setId(sessionId);
        s.setStatus("closed");
        s.setUpdateTime(LocalDateTime.now());
        updateById(s);
    }

    public List<ChatSession> listSessions(Long userId) {
        return lambdaQuery().eq(ChatSession::getUserId, userId)
            .orderByDesc(ChatSession::getUpdateTime).list();
    }
}
