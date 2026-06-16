<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">财务管理</div>
        <div class="page-subtitle">概览 / 提现 / 结算 / 账单</div>
      </div>
      <el-space>
        <el-radio-group v-model="tab" @change="onTabChange">
          <el-radio-button value="overview">概览</el-radio-button>
          <el-radio-button value="withdraw">提现</el-radio-button>
          <el-radio-button value="settle">结算</el-radio-button>
          <el-radio-button value="bills">账单</el-radio-button>
        </el-radio-group>
      </el-space>
    </div>

    <!-- 概览 -->
    <template v-if="tab === 'overview'">
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="stat-card grad-primary">
            <div class="stat-label">总营收 (30 天)</div>
            <div class="stat-value">¥{{ Number(overview.revenue || 0).toFixed(2) }}</div>
            <div class="stat-delta">{{ overview.orderCount || 0 }} 单</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-label">退款</div>
            <div class="stat-value" style="color: var(--c-danger)">¥{{ Number(overview.refund || 0).toFixed(2) }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-label">净收入</div>
            <div class="stat-value" style="color: var(--c-success)">¥{{ Number(overview.net || 0).toFixed(2) }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-label">利润率</div>
            <div class="stat-value">{{ profitRate }}%</div>
          </div>
        </el-col>
      </el-row>

      <div class="card" style="margin-top: 16px">
        <div class="card-title">30 天营收趋势</div>
        <div v-if="trendBars.length === 0" class="empty-hint">暂无数据</div>
        <div v-else class="trend-chart">
          <div
            v-for="d in trendBars"
            :key="d.date"
            class="trend-bar"
            :style="{ height: d.percent + '%' }"
            :title="`${d.date}: ¥${d.amount.toFixed(2)} / ${d.count} 单`"
          >
            <div class="trend-bar-value">¥{{ d.amount.toFixed(0) }}</div>
            <div class="trend-bar-date">{{ d.date.slice(5) }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- 提现 -->
    <template v-if="tab === 'withdraw'">
      <div class="card">
        <el-table :data="withdraws" v-loading="loading">
          <el-table-column prop="_id" label="申请 ID" width="200" />
          <el-table-column prop="userId" label="用户" min-width="160" />
          <el-table-column prop="amount" label="金额" width="120">
            <template #default="{ row }">
              <span style="color: var(--c-danger); font-weight: 600">¥{{ row.amount }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="withdrawType(row.status)" size="small">
                {{ withdrawLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="applyTime" label="申请时间" width="160">
            <template #default="{ row }">{{ formatTime(row.applyTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === 0" size="small" type="primary" @click="onApprove(row)">同意</el-button>
              <el-button v-if="row.status === 0" size="small" type="danger" @click="onReject(row)">拒绝</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- 结算 -->
    <template v-if="tab === 'settle'">
      <div class="card">
        <div class="page-header" style="margin-bottom: 16px">
          <div></div>
          <el-button type="primary" :icon="Plus" @click="onSettle">发起结算</el-button>
        </div>
        <el-table :data="settles" v-loading="loading">
          <el-table-column prop="_id" label="结算单" width="200" />
          <el-table-column prop="merchantId" label="商家" width="160" />
          <el-table-column prop="totalAmount" label="总金额" width="120">
            <template #default="{ row }">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="commissionAmount" label="佣金" width="120">
            <template #default="{ row }">¥{{ Number(row.commissionAmount || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="netAmount" label="实结" width="120">
            <template #default="{ row }">
              <span style="color: var(--c-success); font-weight: 600">¥{{ Number(row.netAmount || 0).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'warning'" size="small">
                {{ row.status === 1 ? '已结' : '待结' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createTime" label="创建时间" width="160">
            <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- 账单 -->
    <template v-if="tab === 'bills'">
      <div class="card">
        <el-table :data="bills" v-loading="loading">
          <el-table-column prop="_id" label="账单 ID" width="200" />
          <el-table-column prop="userId" label="用户" width="160" />
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="row.type === 'income' ? 'success' : 'danger'">
                {{ row.type === 'income' ? '收入' : '支出' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额" width="120">
            <template #default="{ row }">
              <span :style="{ color: row.type === 'income' ? 'var(--c-success)' : 'var(--c-danger)', fontWeight: 600 }">
                {{ row.type === 'income' ? '+' : '-' }}¥{{ row.amount }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
          <el-table-column prop="ts" label="时间" width="160">
            <template #default="{ row }">{{ formatTime(row.ts) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { finance as financeApi } from '@/api'

const tab = ref('overview')
const loading = ref(false)
const overview = ref({})
const trendBars = computed(() => {
  const byDay = overview.value.byDay || {}
  const arr = Object.entries(byDay).map(([date, v]) => ({
    date, amount: v.amount || 0, count: v.count || 0
  }))
  const max = Math.max(1, ...arr.map(x => x.amount))
  return arr.map(x => ({ ...x, percent: (x.amount / max) * 100 }))
})
const profitRate = computed(() => {
  const r = Number(overview.value.revenue || 0)
  const n = Number(overview.value.net || 0)
  return r > 0 ? ((n / r) * 100).toFixed(1) : 0
})

const withdraws = ref([])
const settles = ref([])
const bills = ref([])

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(typeof ts === 'number' ? ts : Number(ts)).toLocaleString('zh-CN', { hour12: false })
}

function withdrawType(s) { return ({ 0: 'warning', 1: 'success', '-1': 'danger' }[s]) || 'info' }
function withdrawLabel(s) { return ({ 0: '待审', 1: '已通过', '-1': '已拒' }[s]) || '未知' }

async function loadOverview() {
  loading.value = true
  try {
    const r = await financeApi.overview({})
    overview.value = r || {}
  } finally {
    loading.value = false
  }
}

async function loadWithdraws() {
  loading.value = true
  try {
    const r = await financeApi.withdraws({ page: 1, size: 20 })
    withdraws.value = r.list || []
  } finally {
    loading.value = false
  }
}

async function loadSettles() {
  loading.value = true
  try {
    const r = await financeApi.settles({ page: 1, size: 20 })
    // 后端还没完整接,先 mock
    settles.value = (r && r.list) || []
  } finally {
    loading.value = false
  }
}

async function loadBills() {
  loading.value = true
  try {
    const r = await financeApi.bills({ page: 1, size: 20 })
    bills.value = (r && r.list) || []
  } finally {
    loading.value = false
  }
}

function onTabChange(t) {
  if (t === 'overview') loadOverview()
  else if (t === 'withdraw') loadWithdraws()
  else if (t === 'settle') loadSettles()
  else if (t === 'bills') loadBills()
}

async function onApprove(row) {
  try {
    await ElMessageBox.confirm(`同意提现 ¥${row.amount}?`, '提示', { type: 'warning' })
    await financeApi.approveWithdraw(row._id)
    ElMessage.success('已同意')
    loadWithdraws()
  } catch (e) {}
}

async function onReject(row) {
  try {
    const { value } = await ElMessageBox.prompt('请输入拒绝原因', '拒绝提现')
    await financeApi.rejectWithdraw(row._id, value)
    ElMessage.success('已拒绝')
    loadWithdraws()
  } catch (e) {}
}

async function onSettle() {
  ElMessage.info('发起结算 - 待对接')
}

onMounted(loadOverview)
</script>

<style scoped>
.stat-card {
  background: var(--c-bg-card);
  border-radius: var(--r-lg);
  padding: 20px 24px;
  box-shadow: var(--sh-1);
  margin-bottom: 16px;
}
.stat-card.grad-primary {
  background: var(--grad-primary);
  color: #fff;
}
.stat-label {
  font-size: 13px;
  color: var(--c-text-3);
  margin-bottom: 8px;
}
.stat-card.grad-primary .stat-label { color: rgba(255, 255, 255, 0.85); }
.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--c-text-1);
}
.stat-card.grad-primary .stat-value { color: #fff; }
.stat-delta {
  font-size: 12px;
  color: var(--c-text-3);
  margin-top: 4px;
}
.stat-card.grad-primary .stat-delta { color: rgba(255, 255, 255, 0.85); }

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--c-text-1);
  margin-bottom: 16px;
  padding-left: 8px;
  border-left: 3px solid var(--c-indigo-500);
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 200px;
  padding: 8px 0;
}
.trend-bar {
  flex: 1;
  background: var(--grad-primary);
  border-radius: var(--r-sm) var(--r-sm) 0 0;
  min-height: 4px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  padding: 4px 2px;
  transition: all 0.2s;
  cursor: pointer;
}
.trend-bar:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.32);
}
.trend-bar-value {
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
.trend-bar-date {
  position: absolute;
  bottom: -22px;
  font-size: 11px;
  color: var(--c-text-3);
}

.empty-hint {
  text-align: center;
  padding: 32px;
  color: var(--c-text-3);
  font-size: 13px;
}
</style>
