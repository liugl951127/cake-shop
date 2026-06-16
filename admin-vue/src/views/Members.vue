<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">会员管理</div>
        <div class="page-subtitle">共 {{ total }} 位会员</div>
      </div>
      <el-space>
        <el-input v-model="keyword" placeholder="手机号/昵称" clearable style="width: 240px" @keyup.enter="loadList" />
        <el-select v-model="level" placeholder="等级" clearable style="width: 120px" @change="loadList">
          <el-option v-for="(name, v) in LEVELS" :key="v" :value="Number(v)" :label="name" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="loadList">搜索</el-button>
      </el-space>
    </div>

    <div class="card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="nickName" label="昵称" min-width="120" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column label="等级" width="100">
          <template #default="{ row }">
            <el-tag :type="levelType(row.level)" size="small">
              {{ LEVELS[row.level] || '普通' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="积分" width="100" />
        <el-table-column prop="balance" label="余额" width="120">
          <template #default="{ row }">
            <span style="color: var(--c-danger)">¥{{ Number(row.balance || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '冻结' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="注册时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="onAdjust(row, 'addPoints')">+积分</el-button>
            <el-button size="small" @click="onAdjust(row, 'subPoints')">-积分</el-button>
            <el-dropdown @command="(cmd) => onAdjust(row, cmd)">
              <el-button size="small">
                更多 <el-icon><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="setLevel">调整等级</el-dropdown-item>
                  <el-dropdown-item command="setBalance">调整余额</el-dropdown-item>
                  <el-dropdown-item :command="row.status === 1 ? 'freeze' : 'unfreeze'">
                    {{ row.status === 1 ? '冻结账号' : '解冻账号' }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        layout="total, prev, pager, next, jumper"
        style="margin-top: 16px; justify-content: flex-end; display: flex"
        @current-change="loadList"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, ArrowDown } from '@element-plus/icons-vue'
import { members as membersApi } from '@/api'

const LEVELS = { 0: '普通', 1: '银卡', 2: '金卡', 3: '钻石', 4: '黑金' }

function levelType(l) {
  return ['info', 'primary', 'warning', 'danger', 'success'][l] || 'info'
}

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const keyword = ref('')
const level = ref('')

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(typeof ts === 'number' ? ts : Number(ts)).toLocaleString('zh-CN', { hour12: false })
}

async function loadList() {
  loading.value = true
  try {
    const r = await membersApi.list({ page: page.value, size: size.value, keyword: keyword.value, level: level.value })
    list.value = r.list || []
    total.value = r.total || 0
  } finally {
    loading.value = false
  }
}

async function onAdjust(row, action) {
  let payload, title, label
  if (action === 'addPoints' || action === 'subPoints') {
    const { value } = await ElMessageBox.prompt('请输入积分数量(正整数)', `${action === 'addPoints' ? '增加' : '扣减'}积分`, {
      inputPattern: /^[1-9]\d*$/,
      inputErrorMessage: '请输入正整数'
    })
    payload = { points: Number(value) }
    title = `${row.nickName || row.phone} ${action === 'addPoints' ? '+' : '-'}${value} 分`
  } else if (action === 'setLevel') {
    const { value } = await ElMessageBox.prompt('请输入等级(0-4)', '调整等级', {
      inputPattern: /^[0-4]$/,
      inputErrorMessage: '0-4 之间的数字'
    })
    payload = { level: Number(value) }
  } else if (action === 'setBalance') {
    const { value } = await ElMessageBox.prompt('请输入新余额', '调整余额', {
      inputPattern: /^\d+(\.\d{1,2})?$/,
      inputErrorMessage: '请输入数字'
    })
    payload = { balance: Number(value) }
  } else if (action === 'freeze' || action === 'unfreeze') {
    try {
      await membersApi.adjust(row.userId, { action, reason: action === 'freeze' ? '管理员操作' : '解冻' })
      ElMessage.success(action === 'freeze' ? '已冻结' : '已解冻')
      loadList()
    } catch (e) {}
    return
  } else {
    return
  }
  try {
    await membersApi.adjust(row.userId, { action, payload, reason: '管理员操作' })
    ElMessage.success('操作成功')
    loadList()
  } catch (e) {}
}

onMounted(loadList)
</script>
