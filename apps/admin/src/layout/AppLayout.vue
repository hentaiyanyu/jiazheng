<template>
  <el-container style="height: 100%">
    <el-aside width="210px" style="background: #1f2329">
      <div class="logo">家政清洁 · 管理后台</div>
      <el-menu
        :default-active="route.path"
        router
        background-color="#1f2329"
        text-color="#c9ced6"
        active-text-color="#ffffff"
      >
        <el-menu-item index="/dashboard">数据看板</el-menu-item>
        <el-menu-item index="/orders">订单管理</el-menu-item>
        <el-menu-item index="/staff">保洁师</el-menu-item>
        <el-menu-item index="/refunds">退款记录</el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <span class="title">{{ pageTitle }}</span>
        <span class="user">
          <el-tag v-if="auth.adminInfo" size="small" type="info">
            {{ auth.adminInfo.name }} · {{ roleText }}
          </el-tag>
          <el-button link type="primary" @click="onLogout">退出登录</el-button>
        </span>
      </el-header>

      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const TITLES: Record<string, string> = {
  '/dashboard': '数据看板',
  '/orders': '订单管理',
  '/staff': '保洁师管理',
  '/refunds': '退款记录',
};

const ROLE_TEXT: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  OPERATOR: '运营',
  CS: '客服',
};

const pageTitle = computed(() => TITLES[route.path] || '管理后台');
const roleText = computed(() => ROLE_TEXT[auth.adminInfo?.role] || '');

onMounted(() => {
  if (!auth.adminInfo) {
    auth.fetchProfile().catch(() => undefined);
  }
});

function onLogout() {
  auth.logout();
  router.replace('/login');
}
</script>

<style scoped>
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border-bottom: 1px solid #2c3138;
}

.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #eef0f3;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.user {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
