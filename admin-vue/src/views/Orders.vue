<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">订单管理</div>
        <div class="page-subtitle">共 {{ total }} 单 · 累计 {{ formatMoney(summary.sumTotal) }} · 实付 {{ formatMoney(summary.sumPaid) }}</div>
      </div>
      <el-space>
        <el-input v-model="keyword" placeholder="订单号" clearable style="width: 240px" @keyup.enter="loadList" />
        <el-select v-model="status" placeholder="状态" clearable style="width: 120px" @change="loadList">
          <el-option :value="0" label="待付款" />
          <el-option :value="1" label="已付款" />
          <el-option :value="2" label="制作中" />
          <el-option :value="3" label="配送中" />
          <el-option :value="4" label="已完成" />
          <el-option :value="-1" label="已取消" />
          <el-option :value="-2" label="已退款" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="loadList">搜索</el-button>
      </el-space>
    </div>

    <div class="card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="total" label="金额" width="120">
          <template #default="{ row }">
            <span style="color: var(--c-danger); font-weight: 600">¥{{ row.total }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="payAmount" label="实付" width="120">
          <template #default="{ row }">
            <span v-if="row.payAmount">¥{{ row.payAmount }}</span>
            <span v-else style="color: var(--c-text-3)">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="_openid" label="用户" min-width="180" show-overflow-tooltip />
        <el-table-column prop="createTime" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 2" size="small" type="primary" @click="onShip(row)">发货</el-button>
            <el-button v-if="row.status >= 1 && row.status !== -2" size="small" type="danger" @click="onRefund(row)">退款</el-button>
            <el-button size="small" @click="onPrint(row)">打印</el-button>
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
import { Search } from '@element-plus/icons-vue'
import { orders as ordersApi } from '@/api'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const summary = ref({})
const page = ref(1)
const size = ref(20)
const keyword = ref('')
const status = ref('')

const STATUS = {
  0: { label: '待付款', type: 'warning' },
  1: { label: '已付款', type: 'primary' },
  2: { label: '制作中', type: 'primary' },
  3: { label: '配送中', type: 'success' },
  4: { label: '已完成', type: 'success' },
  '-1': { label: '已取消', type: 'info' },
  '-2': { label: '已退款', type: 'danger' }
}

function statusLabel(s) { return (STATUS[s] || { label: '状态' + s }).label }
function statusType(s) { return (STATUS[s] || { type: 'info' }).type }
function formatMoney(v) { return '¥' + Number(v || 0).toFixed(2) }
function formatTime(ts) {
  if (!ts) return '-'
  return new Date(typeof ts === 'number' ? ts : Number(ts)).toLocaleString('zh-CN', { hour12: false })
}

async function loadList() {
  loading.value = true
  try {
    const r = await ordersApi.list({ page: page.value, size: size.value, keyword: keyword.value, status: status.value })
    list.value = r.list || []
    total.value = r.total || 0
    summary.value = r.summary || {}
  } finally {
    loading.value = false
  }
}

async function onShip(row) {
  const { value } = await ElMessageBox.prompt('请输入配送员姓名', '发货', { confirmButtonText: '发货', cancelButtonText: '取消' })
  await ordersApi.ship(row._id, { name: value, phone: '13800138000', company: '顺丰', deliveryNo: 'SF' + Date.now() })
  ElMessage.success('已发货')
  loadList()
}

async function onRefund(row) {
  const { value } = await ElMessageBox.prompt('请输入退款原因', '退款', { confirmButtonText: '同意退款', cancelButtonText: '取消' })
  await ordersApi.refund(row._id, { action: 'approve', amount: row.payAmount, reason: value })
  ElMessage.success('已退款')
  loadList()
}

function onPrint(row) { ElMessage.info('打印订单: ' + row.orderNo) }

onMounted(loadList)
</script>
