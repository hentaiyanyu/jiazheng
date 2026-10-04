<template>
  <div class="page-card">
    <div class="toolbar">
      <el-select v-model="status" placeholder="全部状态" clearable style="width: 160px" @change="load(1)">
        <el-option label="待审批" value="PENDING" />
        <el-option label="已退款" value="SUCCESS" />
        <el-option label="失败" value="FAILED" />
      </el-select>
      <el-button type="primary" @click="load(1)">查询</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="refundNo" label="退款单号" width="200" />
      <el-table-column prop="orderNo" label="订单号" width="200" />
      <el-table-column label="金额" width="120">
        <template #default="{ row }">¥{{ (row.amount / 100).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="reason" label="原因" min-width="160" />
      <el-table-column prop="operator" label="操作人" width="140" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.status === 'SUCCESS' ? 'success' : row.status === 'PENDING' ? 'warning' : 'danger'" size="small">
            {{ STATUS_TEXT[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'PENDING'" link type="primary" @click="approve(row)">审批通过</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      style="margin-top: 16px; justify-content: flex-end"
      layout="total, prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      @current-change="load"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import client from '../api/client';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待审批',
  SUCCESS: '已退款',
  FAILED: '失败',
};

const list = ref<any[]>([]);
const loading = ref(false);
const status = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

async function load(targetPage?: number) {
  if (targetPage) {
    page.value = targetPage;
  }

  loading.value = true;
  try {
    const result: any = await client.get('/admin/refunds', {
      params: { status: status.value || undefined, page: page.value, pageSize: pageSize.value },
    });
    list.value = result.list || [];
    total.value = result.total || 0;
  } catch (error: any) {
    // 拦截器已提示
  } finally {
    loading.value = false;
  }
}

async function approve(row: any) {
  let amount = row.amount;

  try {
    const result = await ElMessageBox.prompt(
      `退款单 ${row.refundNo}（订单 ${row.orderNo}）\n可按实际情况调整退款金额，单位：元`,
      '退款审批',
      {
        confirmButtonText: '确认退款',
        cancelButtonText: '取消',
        inputValue: (row.amount / 100).toFixed(2),
        inputPattern: /^\d+(\.\d{1,2})?$/,
        inputErrorMessage: '请输入正确的金额（最多两位小数）',
      },
    );

    amount = Math.round(Number(result.value) * 100);
  } catch (error) {
    return;
  }

  try {
    await client.post(`/admin/refunds/${row.id}/approve`, { amount });
    ElMessage.success(`已退款 ¥${(amount / 100).toFixed(2)}`);
    load();
  } catch (error: any) {
    ElMessage.error(error?.message || '操作失败');
  }
}

onMounted(() => load());
</script>
