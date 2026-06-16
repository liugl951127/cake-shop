<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">
        <div class="icon">🎂</div>
        <h1>甜心蛋糕</h1>
        <p>商家管理后台 v28</p>
      </div>
      <el-form :model="form" :rules="rules" ref="formRef" @submit.prevent="onLogin">
        <el-form-item prop="phone">
          <el-input v-model="form.phone" placeholder="账号" size="large" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="onLogin"
          />
        </el-form-item>
        <el-button
          type="primary"
          class="login-btn"
          size="large"
          :loading="loading"
          @click="onLogin"
        >
          登 录
        </el-button>
      </el-form>
      <div class="login-tips">
        默认账号: admin / 123456
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import http from '@/api'

const router = useRouter()
const formRef = ref()
const loading = ref(false)
const form = reactive({ phone: 'admin', password: '123456' })
const rules = {
  phone: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function onLogin() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const r = await http.post('/auth/login', form, { baseURL: '' })
      localStorage.setItem('__admin_token__', r.token)
      ElMessage.success('登录成功')
      router.push('/dashboard')
    } catch (e) {
      // toast 已在 axios interceptor 处理
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at top left, rgba(99, 102, 241, 0.18), transparent 50%),
    radial-gradient(ellipse at bottom right, rgba(129, 140, 248, 0.15), transparent 50%),
    var(--c-bg-page);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--c-bg-card);
  border-radius: 24px;
  padding: 48px 40px;
  box-shadow: 0 12px 40px rgba(99, 102, 241, 0.12);
  border: 1px solid #f0f3f9;
}

.login-logo {
  text-align: center;
  margin-bottom: 32px;
}

.login-logo .icon {
  font-size: 64px;
  display: inline-block;
  filter: drop-shadow(0 6px 16px rgba(99, 102, 241, 0.25));
}

.login-logo h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 12px 0 8px;
  background: var(--grad-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.login-logo p {
  color: var(--c-text-2);
  font-size: 14px;
  margin: 0;
}

.login-btn {
  width: 100%;
  background: var(--grad-primary) !important;
  border: none !important;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.32) !important;
}

.login-tips {
  margin-top: 20px;
  padding: 14px;
  background: var(--c-indigo-50);
  border-radius: 12px;
  font-size: 13px;
  color: var(--c-text-2);
  text-align: center;
  border: 1px solid var(--c-indigo-100);
}
</style>
