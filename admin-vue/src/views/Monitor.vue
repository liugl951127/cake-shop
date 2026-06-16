<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">监控审计</div>
        <div class="page-subtitle">性能 / 异常 / 操作审计 / 告警</div>
      </div>
      <el-radio-group v-model="tab" @change="onTabChange">
        <el-radio-button value="perf">性能</el-radio-button>
        <el-radio-button value="errors">异常</el-radio-button>
        <el-radio-button value="audit">审计</el-radio-button>
        <el-radio-button value="fingerprint">设备</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 性能 -->
    <template v-if="tab === 'perf'">
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-label">采样数</div>
            <div class="stat-value">{{ perf.samples || 0 }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-label">P50</div>
            <div class="stat-value" style="color: var(--c-indigo-500)">{{ perf.p50 || 0 }}<span>ms</span></div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-label">P90</div>
            <div class="stat-value" style="color: var(--c-indigo-700)">{{ perf.p90 || 0 }}<span>ms</span></div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card" :class="{ 'warn': perf.p99 > 1000 }">
            <div class="stat-label">P99</div>
            <div class="stat-value" :style="{ color: perf.p99 > 1000 ? 'var(--c-warning)' : 'var(--c-text-1)' }">
              {{ perf.p99 || 0 }}<span>ms</span>
            </div>
          </div>
        </el-col>
      </el-row>

      <div class="card" style="margin-top: 16px">
        <div class="card-title">性能指标分布</div>
        <div v-if="!perf.samples" class="empty-hint">暂无采样</div>
        <div v-else class="perf-summary">
          <div class="perf-row">
            <span>最小:</span>
            <span class="perf-val">{{ perf.min || 0 }} ms</span>
          </div>
          <div class="perf-row">
            <span>最大:</span>
            <span class="perf-val">{{ perf.max || 0 }} ms</span>
          </div>
          <div class="perf-row">
            <span>平均:</span>
            <span class="perf-val">{{ perf.avg || 0 }} ms</span>
          </div>
        </div>
      </div>
    </template>

    <!-- 异常 -->
    <template v-if="tab === 'errors'">
      <div class="card">
        <el-table :data="errors" v-loading="loading" stripe>
          <el-table-column prop="ts" label="时间" width="160">
            <template #default="{ row }">{{ formatTime(row.ts) }}</template>
          </el-table-column>
          <el-table-column label="级别" width="100">
            <template #default="{ row }">
              <el-tag :type="severityType(row.severity)" size="small">
                {{ severityLabel(row.severity) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="message" label="错误信息" min-width="300" show-overflow-tooltip />
          <el-table-column prop="path" label="路径" min-width="200" show-overflow-tooltip />
          <el-table-column prop="userId" label="用户" width="160" />
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="showErrorDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- 审计 -->
    <template v-if="tab === 'audit'">
      <div class="card">
        <el-table :data="audits" v-loading="loading" stripe>
          <el-table-column prop="ts" label="时间" width="160">
            <template #default="{ row }">{{ formatTime(row.ts) }}</template>
          </el-table-column>
          <el-table-column prop="action" label="操作" width="200">
            <template #default="{ row }">
              <el-tag size="small" type="primary" effect="plain">{{ row.action }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="adminName" label="管理员" width="120">
            <template #default="{ row }">
              {{ row.adminName || row.adminId || 'system' }}
            </template>
          </el-table-column>
          <el-table-column prop="resourceType" label="资源" width="120" />
          <el-table-column prop="resourceId" label="资源 ID" width="200" show-overflow-tooltip />
          <el-table-column label="详情" min-width="200">
            <template #default="{ row }">
              <code v-if="row.payload" style="font-size: 11px; color: var(--c-text-3)">
                {{ JSON.stringify(row.payload).slice(0, 80) }}
              </code>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="auditTotal"
          layout="total, prev, pager, next, jumper"
          style="margin-top: 16px; justify-content: flex-end; display: flex"
          @current-change="loadAudits"
        />
      </div>
    </template>

    <!-- 设备 -->
    <template v-if="tab === 'fingerprint'">
      <div class="card">
        <div class="card-title">设备指纹聚合 (Top 50)</div>
        <el-table :data="fingerprints" v-loading="loading" stripe>
          <el-table-column prop="fingerprint" label="指纹" min-width="200" />
          <el-table-column prop="count" label="出现次数" width="120" sortable />
          <el-table-column prop="firstTs" label="首次出现" width="160">
            <template #default="{ row }">{{ formatTime(row.firstTs) }}</template>
          </el-table-column>
          <el-table-column prop="lastTs" label="最近出现" width="160">
            <template #default="{ row }">{{ formatTime(row.lastTs) }}</template>
          </el-table-column>
          <el-table-column label="关联设备" min-width="200">
            <template #default="{ row }">
              <el-tag
                v-for="(d, i) in row.devices"
                :key="i"
                size="small"
                style="margin-right: 4px; margin-bottom: 4px"
              >{{ d }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { monitor as monitorApi } from '@/api'

const tab = ref('perf')
const loading = ref(false)

const perf = ref({})
const errors = ref([])
const audits = ref([])
const auditTotal = ref(0)
const page = ref(1)
const size = ref(20)
const fingerprints = ref([])

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(typeof ts === 'number' ? ts : Number(ts)).toLocaleString('zh-CN', { hour12: false })
}

function severityType(s) { return ({ 1: 'warning', 2: 'danger', 3: 'info' }[s]) || 'info' }
function severityLabel(s) { return ({ 1: '警告', 2: '严重', 3: '信息' }[s]) || '普通' }

async function loadPerf() {
  loading.value = true
  try {
    const r = await monitorApi.perf({})
    perf.value = r || {}
  } finally {
    loading.value = false
  }
}

async function loadErrors() {
  loading.value = true
  try {
    const r = await monitorApi.errors({ page: 1, size: 30 })
    errors.value = (r && r.list) || []
  } finally {
    loading.value = false
  }
}

async function loadAudits() {
  loading.value = true
  try {
    const r = await monitorApi.audit({ page: page.value, size: size.value })
    audits.value = (r && r.list) || []
    auditTotal.value = (r && r.total) || 0
  } finally {
    loading.value = false
  }
}

async function loadFingerprints() {
  loading.value = true
  try {
    // 后端 fingerprint API 已存在
    const r = await fetch('/api/v1/admin/monitor/fingerprint').then(x => x.json()).catch(() => ({}))
    fingerprints.value = (r && r.data && r.data.list) || []
  } catch (e) {
    fingerprints.value = []
  } finally {
    loading.value = false
  }
}

function onTabChange(t) {
  if (t === 'perf') loadPerf()
  else if (t === 'errors') loadErrors()
  else if (t === 'audit') loadAudits()
  else if (t === 'fingerprint') loadFingerprints()
}

function showErrorDetail(row) {
  ElMessageBox.alert(
    `<pre style="font-size: 12px; line-height: 1.5; white-space: pre-wrap">${JSON.stringify(row, null, 2)}</pre>`,
    '错误详情',
    { dangerouslyUseHTMLString: true }
  )
}

onMounted(loadPerf)
</script>

<style scoped>
.stat-card {
  background: var(--c-bg-card);
  border-radius: var(--r-lg);
  padding: 20px 24px;
  box-shadow: var(--sh-1);
  margin-bottom: 16px;
}
.stat-card.warn {
  border-left: 4px solid var(--c-warning);
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
.stat-value span {
  font-size: 12px;
  color: var(--c-text-3);
  margin-left: 4px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--c-text-1);
  margin-bottom: 16px;
  padding-left: 8px;
  border-left: 3px solid var(--c-indigo-500);
}

.perf-summary {
  display: flex;
  gap: 24px;
}
.perf-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--c-indigo-50);
  border-radius: var(--r-md);
  font-size: 14px;
}
.perf-val {
  font-size: 18px;
  font-weight: 600;
  color: var(--c-indigo-700);
}

.empty-hint {
  text-align: center;
  padding: 32px;
  color: var(--c-text-3);
  font-size: 13px;
}
</style>
