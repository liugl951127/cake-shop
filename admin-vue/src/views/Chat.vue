<template>
  <div class="chat-page">
    <!-- 左侧会话列表 -->
    <div class="chat-sidebar">
      <div class="chat-sidebar-head">
        <el-input v-model="keyword" placeholder="搜索用户" clearable size="small" @keyup.enter="loadSessions" />
        <el-select v-model="status" size="small" clearable placeholder="状态" style="margin-top: 8px" @change="loadSessions">
          <el-option value="pending" label="待接" />
          <el-option value="ai" label="AI" />
          <el-option value="agent" label="客服" />
          <el-option value="closed" label="已关" />
        </el-select>
      </div>
      <el-scrollbar class="chat-session-list">
        <div
          v-for="s in sessions"
          :key="s._id"
          :class="['session-item', { active: currentId === s._id }]"
          @click="selectSession(s)"
        >
          <el-avatar :size="40" :src="s.userAvatar" class="avatar">
            {{ (s.userName || '客').charAt(0) }}
          </el-avatar>
          <div class="session-info">
            <div class="session-name">
              {{ s.userName || s._openid.slice(-6) }}
              <el-tag size="small" :type="statusTagType(s.status)" effect="plain">
                {{ statusLabel(s.status) }}
              </el-tag>
            </div>
            <div class="session-last line-1">{{ s.lastMessage || '...' }}</div>
          </div>
          <div class="session-time">{{ formatTime(s.lastMessageTime) }}</div>
        </div>
        <div v-if="!loading && sessions.length === 0" class="empty-hint">暂无会话</div>
      </el-scrollbar>
    </div>

    <!-- 右侧聊天面板 -->
    <div class="chat-main">
      <template v-if="current">
        <div class="chat-head">
          <div>
            <div class="chat-user">{{ current.userName || current._openid }}</div>
            <div class="chat-meta">会话 ID: {{ current._id }}</div>
          </div>
          <el-space>
            <el-button size="small" @click="onTransfer">转接</el-button>
            <el-button size="small" type="danger" @click="onClose">关闭</el-button>
          </el-space>
        </div>

        <el-scrollbar ref="msgScrollRef" class="chat-messages">
          <div
            v-for="m in messages"
            :key="m._id"
            :class="['msg', m.fromType === 'agent' || m.fromType === 'admin' ? 'right' : 'left']"
          >
            <div class="msg-bubble">
              <div v-if="m.type === 'text'">{{ m.content }}</div>
              <div v-else-if="m.type === 'image'" class="msg-image">
                <el-image :src="m.content" :preview-src-list="[m.content]" :initial-index="0" fit="cover" style="max-width: 200px" />
              </div>
              <div v-else class="msg-other">[{{ m.type }}] {{ m.content }}</div>
            </div>
            <div class="msg-time">{{ formatTime(m.ts) }}</div>
          </div>
          <div v-if="messages.length === 0" class="empty-hint">暂无消息</div>
        </el-scrollbar>

        <div class="chat-input">
          <el-input
            v-model="inputText"
            type="textarea"
            :rows="2"
            placeholder="输入消息,Enter 发送 / Shift+Enter 换行"
            @keydown.enter.exact.prevent="onSend"
          />
          <el-button type="primary" class="send-btn" @click="onSend" :disabled="!inputText.trim()">
            发送
          </el-button>
        </div>
      </template>
      <div v-else class="chat-empty">
        <el-empty description="选择一个会话开始" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { chat as chatApi } from '@/api'

const keyword = ref('')
const status = ref('')
const sessions = ref([])
const current = ref(null)
const currentId = ref('')
const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const msgScrollRef = ref()

const STATUS_MAP = {
  pending: { label: '待接', type: 'warning' },
  ai: { label: 'AI', type: 'info' },
  agent: { label: '客服', type: 'success' },
  transferred: { label: '已转', type: 'primary' },
  closed: { label: '已关', type: 'danger' }
}

function statusLabel(s) { return (STATUS_MAP[s] || { label: s }).label }
function statusTagType(s) { return (STATUS_MAP[s] || { type: 'info' }).type }
function formatTime(ts) {
  if (!ts) return '-'
  const d = new Date(typeof ts === 'number' ? ts : Number(ts))
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}

async function loadSessions() {
  loading.value = true
  try {
    const r = await chatApi.sessions({ page: 1, size: 50, status: status.value, openid: keyword.value })
    sessions.value = r.list || []
  } finally {
    loading.value = false
  }
}

async function selectSession(s) {
  current.value = s
  currentId.value = s._id
  await loadHistory()
}

async function loadHistory() {
  if (!currentId.value) return
  try {
    const r = await chatApi.history(currentId.value, { page: 1, size: 50 })
    messages.value = r.list || []
    await nextTick()
    if (msgScrollRef.value) {
      const wrap = msgScrollRef.value.$el.querySelector('.el-scrollbar__wrap')
      if (wrap) wrap.scrollTop = wrap.scrollHeight
    }
  } catch (e) {}
}

async function onSend() {
  const text = inputText.value.trim()
  if (!text || !currentId.value) return
  try {
    await chatApi.send(currentId.value, { type: 'text', content: text })
    inputText.value = ''
    await loadHistory()
  } catch (e) {}
}

async function onClose() {
  try {
    await ElMessageBox.confirm('确定关闭该会话?', '提示', { type: 'warning' })
    await chatApi.close(currentId.value)
    ElMessage.success('已关闭')
    await loadSessions()
  } catch (e) {}
}

async function onTransfer() {
  try {
    const r = await chatApi.agents()
    const list = (r && r.list) || []
    if (list.length === 0) { ElMessage.warning('没有可用客服'); return }
    const { value } = await ElMessageBox.prompt('输入目标客服 ID(从客服列表选)', '转接', {
      inputPattern: /\S+/, inputErrorMessage: '不能为空'
    })
    await chatApi.transfer(currentId.value, { toAgentId: value })
    ElMessage.success('已转接')
  } catch (e) {}
}

let timer = null
onMounted(() => {
  loadSessions()
  timer = setInterval(loadSessions, 10000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.chat-page {
  display: flex;
  gap: 16px;
  height: calc(100vh - 108px);
}
.chat-sidebar {
  width: 320px;
  background: var(--c-bg-card);
  border-radius: var(--r-lg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--sh-1);
}
.chat-sidebar-head {
  padding: 12px;
  border-bottom: 1px solid var(--c-border-soft);
}
.chat-session-list {
  flex: 1;
}
.session-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--c-border-soft);
  cursor: pointer;
  transition: background 0.15s;
}
.session-item:hover { background: var(--c-indigo-50); }
.session-item.active { background: var(--c-indigo-100); }
.avatar { flex-shrink: 0; }
.session-info { flex: 1; min-width: 0; }
.session-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
}
.session-last {
  font-size: 12px;
  color: var(--c-text-3);
  margin-top: 2px;
}
.session-time {
  font-size: 11px;
  color: var(--c-text-3);
  white-space: nowrap;
}

.chat-main {
  flex: 1;
  background: var(--c-bg-card);
  border-radius: var(--r-lg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--sh-1);
  overflow: hidden;
}
.chat-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--c-border-soft);
  background: var(--c-indigo-50);
}
.chat-user { font-size: 16px; font-weight: 600; }
.chat-meta { font-size: 12px; color: var(--c-text-3); margin-top: 2px; }

.chat-messages {
  flex: 1;
  padding: 16px 20px;
  background: var(--c-bg-page);
}
.msg {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  max-width: 70%;
}
.msg.left { align-self: flex-start; }
.msg.right { align-self: flex-end; align-items: flex-end; }
.msg-bubble {
  padding: 10px 14px;
  border-radius: var(--r-md);
  background: #fff;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.5;
  box-shadow: var(--sh-1);
}
.msg.right .msg-bubble {
  background: var(--grad-primary);
  color: #fff;
}
.msg-image img { max-width: 200px; border-radius: var(--r-sm); }
.msg-time {
  font-size: 11px;
  color: var(--c-text-3);
  margin-top: 4px;
}

.chat-input {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--c-border-soft);
  background: var(--c-bg-card);
}
.chat-input :deep(.el-textarea__inner) {
  border-radius: var(--r-md);
  resize: none;
}
.send-btn {
  align-self: flex-end;
  height: 60px;
  background: var(--grad-primary) !important;
  border: none !important;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.32) !important;
}

.chat-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.empty-hint {
  text-align: center;
  padding: 24px;
  color: var(--c-text-3);
  font-size: 13px;
}
</style>
