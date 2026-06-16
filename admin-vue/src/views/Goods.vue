<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">商品管理</div>
        <div class="page-subtitle">共 {{ total }} 件商品</div>
      </div>
      <el-space>
        <el-input v-model="keyword" placeholder="搜索商品" clearable style="width: 240px" @keyup.enter="loadList" />
        <el-select v-model="status" placeholder="状态" clearable style="width: 120px" @change="loadList">
          <el-option :value="1" label="在售" />
          <el-option :value="0" label="下架" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="loadList">搜索</el-button>
        <el-button type="primary" :icon="Plus" @click="onAdd">新增</el-button>
      </el-space>
    </div>

    <div class="card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="image" label="图片" width="80">
          <template #default="{ row }">
            <el-image :src="row.image" style="width: 56px; height: 56px; border-radius: 8px" fit="cover" />
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column label="价格" width="120">
          <template #default="{ row }">
            <span style="color: var(--c-danger); font-weight: 600">¥{{ row.price }}</span>
            <span v-if="row.originPrice" style="text-decoration: line-through; color: var(--c-text-3); margin-left: 4px; font-size: 12px">¥{{ row.originPrice }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="100">
          <template #default="{ row }">
            <el-tag :type="row.stock < 10 ? 'danger' : 'success'" size="small">{{ row.stock }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sales" label="销量" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '在售' : '下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" :icon="row.status === 1 ? 'Bottom' : 'Top'" @click="onToggleStatus(row)">
              {{ row.status === 1 ? '下架' : '上架' }}
            </el-button>
            <el-button size="small" type="primary" @click="onEdit(row)">编辑</el-button>
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
import { Search, Plus } from '@element-plus/icons-vue'
import { goods as goodsApi } from '@/api'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const keyword = ref('')
const status = ref('')

async function loadList() {
  loading.value = true
  try {
    const r = await goodsApi.list({ page: page.value, size: size.value, keyword: keyword.value, status: status.value })
    list.value = r.list || []
    total.value = r.total || 0
  } finally {
    loading.value = false
  }
}

async function onToggleStatus(row) {
  const isOn = row.status === 1
  await ElMessageBox.confirm(`确定${isOn ? '下架' : '上架'}「${row.name}」?`, '提示', { type: 'warning' })
  await (isOn ? goodsApi.offSale(row._id) : goodsApi.onSale(row._id))
  ElMessage.success('操作成功')
  loadList()
}

function onAdd() { ElMessage.info('新增功能待对接云函数') }
function onEdit(row) { ElMessage.info('编辑: ' + row.name) }

onMounted(loadList)
</script>
