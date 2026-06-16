<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">仪表盘</div>
        <div class="page-subtitle">实时业务概览</div>
      </div>
      <el-button :icon="Refresh" @click="loadAll">刷新</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="6" v-for="card in cards" :key="card.key">
        <div class="stat-card" :class="card.cls">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-delta">{{ card.delta }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <div class="card">
          <div class="card-title">接口性能 (P50 / P90 / P99)</div>
          <div class="perf-grid">
            <div class="perf-item">
              <div class="perf-num" style="color: var(--c-indigo-500)">{{ perf.p50 || 0 }}<span>ms</span></div>
              <div class="perf-label">P50</div>
            </div>
            <div class="perf-item">
              <div class="perf-num" style="color: var(--c-indigo-600)">{{ perf.p90 || 0 }}<span>ms</span></div>
              <div class="perf-label">P90</div>
            </div>
            <div class="perf-item">
              <div class="perf-num" style="color: var(--c-warning)">{{ perf.p99 || 0 }}<span>ms</span></div>
              <div class="perf-label">P99</div>
            </div>
            <div class="perf-item">
              <div class="perf-num">{{ perf.samples || 0 }}</div>
              <div class="perf-label">采样</div>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card">
          <div class="card-title">最近审计 / 活动</div>
          <el-table :data="auditList" size="small" :show-header="false" v-loading="loading">
            <el-table-column>
              <template #default="{ row }">
                <el-tag size="small" type="primary" effect="plain">{{ row.action }}</el-tag>
                <span style="margin-left: 8px">{{ row.adminName || row.adminId || 'system' }}</span>
              </template>
            </el-table-column>
            <el-table-column width="140" align="right">
              <template #default="{ row }">
                <span style="color: var(--c-text-3); font-size: 12px">{{ formatTime(row.ts) }}</span>
              </template>
            </el-table-column>
            <template #empty>
              <div style="padding: 24px; text-align: center; color: var(--c-text-3)">暂无活动</div>
            </template>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { dashboard, monitor } from '@/api'

const loading = ref(false)
const overview = ref({})
const perf = ref({})
const auditList = ref([])

const cards = computed(() => {
  const t = overview.value.today || {}
  const total = overview.value.total || {}
  const pending = overview.value.pending || {}
  return [
    { key: 'revenue', label: '今日营收', value: '¥' + Number(t.revenue || 0).toFixed(2), delta: t.orderCount + ' 单', cls: 'grad-primary' },
    { key: 'members', label: '今日新会员', value: t.newMembers || 0, delta: '人' },
    { key: 'goods', label: '商品总数', value: total.goods || 0, delta: '件' },
    { key: 'users', label: '会员总数', value: total.members || 0, delta: '人' },
    { key: 'orders', label: '待处理订单', value: pending.orders || 0, delta: '需处理', cls: (pending.orders || 0) > 0 ? 'warn' : '' },
    { key: 'tickets', label: '待接会话', value: pending.tickets || 0, delta: '需接听', cls: (pending.tickets || 0) > 0 ? 'warn' : '' },
    { key: 'audit', label: '今日审计', value: total.auditToday || 0, delta: '条' },
    { key: 'error', label: '今日异常', value: total.errorToday || 0, delta: (total.errorToday || 0) > 0 ? '需关注' : '正常', cls: (total.errorToday || 0) > 0 ? 'danger' : '' }
  ]
})

async function loadAll() {
  loading.value = true
  try {
    const [d, p, a] = await Promise.all([
      dashboard.overview(),
      monitor.perf().catch(() => ({})),
      monitor.audit({ page: 1, size: 8 }).catch(() => ({ list: [] }))
    ])
    overview.value = d
    perf.value = p
    auditList.value = (a && a.list) || []
  } finally {
    loading.value = false
  }
}

function formatTime(ts) {
  if (!ts) return '-'
  const d = new Date(typeof ts === 'number' ? ts : Number(ts))
  return d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(loadAll)
</script>

<style scoped>
.stat-card {
  background: var(--c-bg-card);
  border-radius: var(--r-lg);
  padding: 20px 24px;
  box-shadow: var(--sh-1);
  margin-bottom: 16px;
  transition: all 0.2s;
}
.stat-card:hover {
  box-shadow: var(--sh-2);
  transform: translateY(-2px);
}
.stat-card.grad-primary {
  background: var(--grad-primary);
  color: #fff;
}
.stat-card.grad-primary .stat-label,
.stat-card.grad-primary .stat-delta {
  color: rgba(255, 255, 255, 0.85);
}
.stat-card.warn {
  border-left: 4px solid var(--c-warning);
}
.stat-card.danger {
  border-left: 4px solid var(--c-danger);
}
.stat-label {
  font-size: 13px;
  color: var(--c-text-3);
  margin-bottom: 8px;
}
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

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--c-text-1);
  margin-bottom: 16px;
  padding-left: 8px;
  border-left: 3px solid var(--c-indigo-500);
}

.perf-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.perf-item {
  text-align: center;
  padding: 16px 8px;
  background: var(--c-indigo-50);
  border-radius: var(--r-md);
}
.perf-num {
  font-size: 24px;
  font-weight: 700;
  color: var(--c-text-1);
}
.perf-num span {
  font-size: 12px;
  color: var(--c-text-3);
  margin-left: 2px;
}
.perf-label {
  font-size: 12px;
  color: var(--c-text-3);
  margin-top: 4px;
}
</style>
