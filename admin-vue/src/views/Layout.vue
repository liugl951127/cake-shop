<template>
  <el-container class="layout">
    <el-aside width="220px" class="sidebar">
      <div class="brand">
        <span class="icon">🎂</span>
        <span class="name">甜心蛋糕</span>
      </div>
      <el-menu
        :default-active="route.path"
        :router="true"
        class="menu"
        background-color="transparent"
        text-color="#cbd5e1"
        active-text-color="#fff"
      >
        <el-menu-item
          v-for="r in menuRoutes"
          :key="r.path"
          :index="`/${r.path}`"
        >
          <el-icon><component :is="r.meta.icon" /></el-icon>
          <span>{{ r.meta.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <div class="breadcrumb">{{ currentTitle }}</div>
        <div class="user">
          <el-dropdown @command="onCommand">
            <span class="user-name">
              <el-icon><UserFilled /></el-icon>
              管理员
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UserFilled, ArrowDown } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()

const menuRoutes = [
  { path: 'dashboard', meta: { title: '仪表盘', icon: 'Odometer' } },
  { path: 'goods', meta: { title: '商品管理', icon: 'Goods' } },
  { path: 'orders', meta: { title: '订单管理', icon: 'List' } },
  { path: 'members', meta: { title: '会员管理', icon: 'User' } },
  { path: 'marketing', meta: { title: '营销活动', icon: 'Present' } },
  { path: 'chat', meta: { title: '客服管理', icon: 'ChatDotRound' } },
  { path: 'finance', meta: { title: '财务管理', icon: 'Money' } },
  { path: 'monitor', meta: { title: '监控审计', icon: 'Monitor' } }
]

const currentTitle = computed(() => {
  const r = menuRoutes.find(x => `/${x.path}` === route.path)
  return r ? r.meta.title : '管理后台'
})

function onCommand(cmd) {
  if (cmd === 'logout') {
    localStorage.removeItem('__admin_token__')
    ElMessage.success('已退出')
    router.push('/login')
  }
}
</script>

<style scoped>
.layout {
  min-height: 100vh;
}

.sidebar {
  background: linear-gradient(180deg, #312e81 0%, #1e1b4b 100%);
  color: #fff;
  position: relative;
  overflow: hidden;
}

.sidebar::before {
  content: '';
  position: absolute;
  top: -50px;
  right: -50px;
  width: 200px;
  height: 200px;
  background: rgba(99, 102, 241, 0.15);
  border-radius: 50%;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  z-index: 1;
}

.brand .icon {
  font-size: 32px;
}

.brand .name {
  font-size: 18px;
  font-weight: 600;
}

.menu {
  border: none !important;
  position: relative;
  z-index: 1;
}

.menu :deep(.el-menu-item) {
  border-radius: 0 24px 24px 0;
  margin: 4px 0;
  margin-right: 12px;
}

.menu :deep(.el-menu-item.is-active) {
  background: var(--grad-primary) !important;
  color: #fff !important;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.32);
}

.menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #fff !important;
}

.topbar {
  background: var(--c-bg-card);
  border-bottom: 1px solid #f0f3f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--sh-1);
  z-index: 10;
}

.breadcrumb {
  font-size: 16px;
  font-weight: 500;
  color: var(--c-text-1);
}

.user-name {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--c-text-2);
  font-size: 14px;
}

.main {
  background: var(--c-bg-page);
  padding: 24px;
  min-height: calc(100vh - 60px);
}
</style>
