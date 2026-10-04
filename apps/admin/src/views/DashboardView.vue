<template>
  <div>
    <div class="stat-grid" v-loading="loading">
      <div class="stat-card">
        <div class="stat-label">今日订单</div>
        <div class="stat-value">{{ data.today.orderCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今日支付订单</div>
        <div class="stat-value">{{ data.today.paidCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今日成交额</div>
        <div class="stat-value">¥{{ (data.today.gmv / 100).toFixed(2) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">待派单</div>
        <div class="stat-value" :class="{ warn: data.pending.dispatch > 0 }">
          {{ data.pending.dispatch }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">服务中</div>
        <div class="stat-value">{{ data.pending.serving }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">待处理退款</div>
        <div class="stat-value" :class="{ warn: data.pending.refunds > 0 }">
          {{ data.pending.refunds }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">可接单保洁师</div>
        <div class="stat-value">{{ data.resource.activeStaff }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">累计用户</div>
        <div class="stat-value">{{ data.resource.totalUsers }}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">
        最近 7 天订单趋势
        <span class="legend"><i class="dot dot-orders"></i>下单 <i class="dot dot-paid"></i>支付</span>
      </div>

      <div class="chart">
        <div v-for="day in data.trend" :key="day.date" class="chart-col">
          <div class="chart-value">{{ day.orderCount }}</div>
          <div class="bars">
            <div class="bar bar-orders" :style="{ height: barHeight(day.orderCount) }"></div>
            <div class="bar bar-paid" :style="{ height: barHeight(day.paidCount) }"></div>
          </div>
          <div class="chart-label">{{ day.date }}</div>
          <div class="chart-amount">¥{{ (day.gmv / 100).toFixed(0) }}</div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">订单状态分布</div>
      <div v-for="item in data.statusDistribution" :key="item.status" class="status-row">
        <div class="status-name">{{ statusLabel(item.status) }}</div>
        <div class="status-track">
          <div class="status-bar" :style="{ width: statusWidth(item.count) }"></div>
        </div>
        <div class="status-count">{{ item.count }}</div>
      </div>
      <div v-if="data.statusDistribution.length === 0" class="tip">暂无数据</div>
    </div>

    <div class="panel">
      <div class="panel-title">保洁师效能（按累计单量排序）</div>
      <el-table :data="data.staffPerformance" border stripe size="small">
        <el-table-column prop="name" label="姓名" width="110" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">{{ STAFF_STATUS[row.status] || row.status }}</template>
        </el-table-column>
        <el-table-column prop="orderCount" label="累计单量" width="100" />
        <el-table-column prop="todayCount" label="今日完成" width="100" />
        <el-table-column label="评分" width="80">
          <template #default="{ row }">{{ row.rating }}</template>
        </el-table-column>
        <el-table-column label="接单率" min-width="150">
          <template #default="{ row }">
            <el-progress :percentage="row.acceptRate" :stroke-width="10" />
          </template>
        </el-table-column>
        <el-table-column label="准时率" min-width="150">
          <template #default="{ row }">
            <el-progress :percentage="row.onTimeRate" :stroke-width="10" color="#00b578" />
          </template>
        </el-table-column>
      </el-table>
      <div v-if="data.staffPerformance.length === 0" class="tip">暂无保洁师数据</div>
    </div>

    <div style="margin-top: 16px">
      <el-button @click="load">刷新</el-button>
      <span style="margin-left: 12px; color: #8a8f99; font-size: 13px">
        数据实时查询自订单表，每 30 秒自动刷新一次
      </span>
    </div>
  </div>
</template>

<style scoped>
.panel {
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  margin-top: 16px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.legend {
  font-size: 12px;
  color: #8a8f99;
  font-weight: 400;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin: 0 4px 0 12px;
}

.dot-orders {
  background: #a8c6ff;
}

.dot-paid {
  background: #2b5cff;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 220px;
}

.chart-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.chart-value {
  font-size: 12px;
  color: #4e5969;
}

.bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  width: 100%;
  justify-content: center;
}

.bar {
  width: 22px;
  border-radius: 4px 4px 0 0;
  min-height: 3px;
}

.bar-orders {
  background: #a8c6ff;
}

.bar-paid {
  background: #2b5cff;
}

.chart-label {
  margin-top: 8px;
  font-size: 12px;
  color: #8a8f99;
}

.chart-amount {
  font-size: 12px;
  color: #4e5969;
}

.status-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.status-name {
  width: 100px;
  font-size: 13px;
  color: #4e5969;
}

.status-track {
  flex: 1;
  height: 14px;
  background: #f2f3f5;
  border-radius: 7px;
  overflow: hidden;
}

.status-bar {
  height: 100%;
  background: #2b5cff;
  border-radius: 7px;
}

.status-count {
  width: 60px;
  text-align: right;
  font-size: 13px;
}

.tip {
  color: #8a8f99;
  font-size: 13px;
}
</style>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import client from '../api/client';

const STATUS_TEXT: Record<string, string> = {
  PENDING_PAYMENT: '待支付',
  PENDING_DISPATCH: '待派单',
  PENDING_ACCEPT: '待接单',
  PENDING_SERVICE: '待服务',
  IN_SERVICE: '服务中',
  PENDING_CONFIRM: '待确认',
  COMPLETED: '已完成',
  RESCHEDULED: '已改期',
  CANCELED: '已取消',
  AFTER_SALES: '售后中',
  REFUNDED: '已退款',
  EXCEPTION: '异常',
};

const STAFF_STATUS: Record<string, string> = {
  PENDING: '待审核',
  ACTIVE: '正常',
  PAUSED: '已暂停',
  BANNED: '已封禁',
};

const loading = ref(false);
const data = reactive({
  today: { orderCount: 0, paidCount: 0, gmv: 0 },
  pending: { dispatch: 0, serving: 0, refunds: 0 },
  resource: { activeStaff: 0, totalUsers: 0 },
  trend: [] as any[],
  statusDistribution: [] as any[],
  staffPerformance: [] as any[],
});

// 趋势图以当天最大单量为基准计算柱高
const maxTrendValue = computed(() =>
  Math.max(1, ...data.trend.map((day) => day.orderCount)),
);

const maxStatusCount = computed(() =>
  Math.max(1, ...data.statusDistribution.map((item) => item.count)),
);

function barHeight(value: number) {
  return `${Math.max(3, Math.round((value / maxTrendValue.value) * 100))}%`;
}

function statusWidth(value: number) {
  return `${Math.max(2, Math.round((value / maxStatusCount.value) * 100))}%`;
}

function statusLabel(status: string) {
  return STATUS_TEXT[status] || status;
}

let timer: any = null;

async function load() {
  loading.value = true;
  try {
    const result: any = await client.get('/admin/dashboard');
    Object.assign(data.today, result.today);
    Object.assign(data.pending, result.pending);
    Object.assign(data.resource, result.resource);
    data.trend = result.trend || [];
    data.statusDistribution = result.statusDistribution || [];
    data.staffPerformance = result.staffPerformance || [];
  } catch (error: any) {
    // 错误提示由拦截器统一处理
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  timer = setInterval(load, 30000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>
