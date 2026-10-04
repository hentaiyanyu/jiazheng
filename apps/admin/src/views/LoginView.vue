<template>
  <div class="login-wrap">
    <el-card class="login-card">
      <div class="brand">家政清洁服务 · 管理后台</div>

      <el-form @submit.prevent="onSubmit">
        <el-form-item>
          <el-input v-model="username" placeholder="用户名" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="password" type="password" placeholder="密码" size="large" show-password />
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="onSubmit">
          登录
        </el-button>
      </el-form>

      <div class="tip">默认账号：admin / admin123（正式环境请立即修改）</div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../store/auth';

const router = useRouter();
const auth = useAuthStore();

const username = ref('admin');
const password = ref('admin123');
const loading = ref(false);

async function onSubmit() {
  if (!username.value || !password.value) {
    ElMessage.warning('请输入用户名和密码');
    return;
  }

  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    ElMessage.success('登录成功');
    router.replace('/dashboard');
  } catch (error: any) {
    ElMessage.error(error?.message || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2329 0%, #2f3944 100%);
}

.login-card {
  width: 380px;
  padding: 12px 8px;
}

.brand {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 24px;
}

.tip {
  margin-top: 16px;
  text-align: center;
  color: #8a8f99;
  font-size: 12px;
}
</style>
