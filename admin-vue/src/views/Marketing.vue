<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">营销活动</div>
        <div class="page-subtitle">共 {{ total }} 个活动</div>
      </div>
      <el-space>
        <el-select v-model="type" placeholder="活动类型" style="width: 140px" @change="loadList">
          <el-option v-for="t in TYPES" :key="t.value" :value="t.value" :label="t.label" />
        </el-select>
        <el-input v-model="keyword" placeholder="搜索活动" clearable style="width: 200px" @keyup.enter="loadList" />
        <el-button type="primary" :icon="Plus" @click="onCreate">新建活动</el-button>
      </el-space>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">活动总数</div>
          <div class="stat-value">{{ total }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card grad-primary">
          <div class="stat-label">进行中</div>
          <div class="stat-value">{{ onCount }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">已下架</div>
          <div class="stat-value">{{ total - onCount }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">参与人数</div>
          <div class="stat-value">{{ participantCount }}</div>
        </div>
      </el-col>
    </el-row>

    <div class="card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="name" label="活动名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="typeLabel" label="类型" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              @change="(v) => onToggle(row, v)"
              :active-color="'#6366f1'"
            />
          </template>
        </el-table-column>
        <el-table-column label="时间" width="320">
          <template #default="{ row }">
            <span style="font-size: 12px; color: var(--c-text-3)">
              {{ formatTime(row.startTime) }} ~ {{ formatTime(row.endTime) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="rule" label="规则" min-width="160" show-overflow-tooltip />
        <el-table-column prop="joined" label="参与数" width="100" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="onEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
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
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { marketing as marketingApi } from '@/api'

const TYPES = [
  { value: 'coupon', label: '优惠券' },
  { value: 'seckill', label: '秒杀' },
  { value: 'group', label: '拼团' },
  { value: 'fullReduce', label: '满减' },
  { value: 'luckyBag', label: '福袋' }
]

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const type = ref('coupon')
const keyword = ref('')

const onCount = computed(() => list.value.filter(x => x.status === 1).length)
const participantCount = computed(() => list.value.reduce((sum, x) => sum + (x.joined || 0), 0))

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(typeof ts === 'number' ? ts : Number(ts)).toLocaleString('zh-CN', { hour12: false })
}

async function loadList() {
  loading.value = true
  try {
    const r = await marketingApi.list(type.value, { page: page.value, size: size.value, keyword: keyword.value })
    list.value = (r.list || []).map(x => ({ ...x, typeLabel: TYPES.find(t => t.value === type.value)?.label || type.value }))
    total.value = r.total || 0
  } finally {
    loading.value = false
  }
}

async function onToggle(row, val) {
  try {
    await marketingApi.toggle(type.value, row._id)
    ElMessage.success(val ? '已上架' : '已下架')
    loadList()
  } catch (e) {}
}

async function onCreate() {
  ElMessageBox.prompt('请输入活动名称', '新建活动', {
    inputPattern: /\S+/,
    inputErrorMessage: '名称不能为空'
  }).then(async ({ value }) => {
    try {
      await marketingApi.create(type.value, { name: value, status: 0 })
      ElMessage.success('已创建')
      loadList()
    } catch (e) {}
  }).catch(() => {})
}

function onEdit(row) { ElMessage.info('编辑活动: ' + row.name) }

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除活动「${row.name}」?`, '提示', { type: 'warning' })
    await marketingApi.remove(type.value, row._id)
    ElMessage.success('已删除')
    loadList()
  } catch (e) {}
}

onMounted(loadList)
</script>

<style scoped>
.stat-card {
  background: var(--c-bg-card);
  border-radius: var(--r-lg);
  padding: 20px 24px;
  box-shadow: var(--sh-1);
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
</style>
