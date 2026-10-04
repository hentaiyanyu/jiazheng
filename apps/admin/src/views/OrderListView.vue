<template>
  <div class="page-card">
    <div class="toolbar">
      <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 160px">
        <el-option v-for="(label, key) in STATUS_TEXT" :key="key" :label="label" :value="key" />
      </el-select>
      <el-input v-model="query.keyword" placeholder="订单号" clearable style="width: 220px" />
      <el-button type="primary" @click="load(1)">查询</el-button>
      <el-button @click="reset">重置</el-button>
      <el-button @click="load()">刷新</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="orderNo" label="订单号" width="190" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="tagType(row.status)" size="small">{{ row.statusText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="服务" min-width="200">
        <template #default="{ row }">
          {{ row.service?.name }} · {{ row.service?.skuName }}
        </template>
      </el-table-column>
      <el-table-column label="服务时间" width="210">
        <template #default="{ row }">{{ row.serviceDate }} {{ row.startTime }}-{{ row.endTime }}</template>
      </el-table-column>
      <el-table-column label="地址" min-width="180">
        <template #default="{ row }">{{ row.address?.district }}{{ row.address?.detail }}</template>
      </el-table-column>
      <el-table-column label="金额" width="110">
        <template #default="{ row }">¥{{ (row.amount.payable / 100).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="用户" width="130">
        <template #default="{ row }">{{ row.user?.nickname || '-' }}</template>
      </el-table-column>
      <el-table-column label="保洁师" width="110">
        <template #default="{ row }">
          <span v-if="row.staffName">{{ row.staffName }}</span>
          <el-tag v-else type="warning" size="small">未派单</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <el-button
            v-if="row.status === 'PENDING_DISPATCH'"
            link
            type="warning"
            @click="openDispatch(row)"
          >派单</el-button>
          <el-button
            v-if="CANCELABLE.indexOf(row.status) >= 0"
            link
            type="danger"
            @click="openCancel(row)"
          >取消</el-button>
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

    <!-- 订单详情 -->
    <el-drawer v-model="detailVisible" title="订单详情" size="640px">
      <div v-if="detail" v-loading="detailLoading">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ detail.statusText }}</el-descriptions-item>
          <el-descriptions-item label="服务">{{ detail.service?.name }} · {{ detail.service?.skuName }}</el-descriptions-item>
          <el-descriptions-item label="服务时间">{{ detail.serviceDate }} {{ detail.startTime }}-{{ detail.endTime }}</el-descriptions-item>
          <el-descriptions-item label="地址" :span="2">
            {{ detail.address?.district }}{{ detail.address?.detail }}
          </el-descriptions-item>
          <el-descriptions-item label="联系人">
            {{ detail.address?.contactName }} {{ detail.address?.contactPhone }}
          </el-descriptions-item>
          <el-descriptions-item label="用户">{{ detail.user?.nickname || '-' }}</el-descriptions-item>
          <el-descriptions-item label="服务费">¥{{ (detail.amount.service / 100).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="附加项">¥{{ (detail.amount.addon / 100).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="加价项">¥{{ (detail.amount.extra / 100).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="优惠">-¥{{ (detail.amount.discount / 100).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="实付" :span="2">
            <b>¥{{ (detail.amount.payable / 100).toFixed(2) }}</b>
          </el-descriptions-item>
        </el-descriptions>

        <h4>派单记录</h4>
        <el-table :data="detail.dispatches" size="small" border>
          <el-table-column prop="staffName" label="保洁师" width="100" />
          <el-table-column prop="status" label="结果" width="100" />
          <el-table-column prop="score" label="得分" width="80" />
          <el-table-column prop="reason" label="备注" />
        </el-table>

        <template
          v-if="detail.images && (detail.images.checkin || (detail.images.finish || []).length > 0)"
        >
          <h4>服务照片</h4>

          <div v-if="detail.images.checkin" class="photo-block">
            <div class="photo-label">到店打卡</div>
            <el-image
              :src="detail.images.checkin"
              :preview-src-list="[detail.images.checkin]"
              fit="cover"
              class="photo"
            />
          </div>

          <div v-if="(detail.images.finish || []).length > 0" class="photo-block">
            <div class="photo-label">完工上报（{{ detail.images.finish.length }} 张）</div>
            <div class="photo-list">
              <el-image
                v-for="(url, index) in detail.images.finish"
                :key="index"
                :src="url"
                :preview-src-list="detail.images.finish"
                :initial-index="index"
                fit="cover"
                class="photo"
              />
            </div>
          </div>
        </template>

        <h4>状态流水</h4>
        <el-timeline>
          <el-timeline-item
            v-for="log in detail.logs"
            :key="log.id"
            :timestamp="formatTime(log.createdAt)"
            placement="top"
          >
            {{ log.fromStatus || '创建' }} → {{ log.toStatus }}
            <span style="color: #8a8f99">（{{ log.operatorType }} {{ log.reason || '' }}）</span>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-drawer>

    <!-- 人工派单 -->
    <el-dialog v-model="dispatchVisible" title="人工派单" width="480px">
      <p style="color: #8a8f99; font-size: 13px">
        不选择保洁师时，系统会按评分、接单率、准时率自动挑一位。
      </p>
      <el-select v-model="selectedStaffId" placeholder="自动选择（推荐）" clearable style="width: 100%">
        <el-option
          v-for="staff in staffOptions"
          :key="staff.id"
          :label="`${staff.name}（评分 ${staff.rating} · 今日已接 ${staff.orderCount} 单）`"
          :value="staff.id"
          :disabled="staff.status !== 'ACTIVE'"
        />
      </el-select>

      <template #footer>
        <el-button @click="dispatchVisible = false">取消</el-button>
        <el-button type="primary" :loading="actionLoading" @click="confirmDispatch">确认派单</el-button>
      </template>
    </el-dialog>

    <!-- 强制取消 -->
    <el-dialog v-model="cancelVisible" title="强制取消订单" width="480px">
      <el-input v-model="cancelReason" type="textarea" :rows="3" placeholder="请填写取消原因（会记录到审计日志）" />
      <p style="color: #8a8f99; font-size: 13px; margin-top: 8px">
        已支付的订单会按规则立即生成退款记录，可在「退款记录」中查看。
      </p>

      <template #footer>
        <el-button @click="cancelVisible = false">返回</el-button>
        <el-button type="danger" :loading="actionLoading" @click="confirmCancel">确认取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
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

const CANCELABLE = ['PENDING_PAYMENT', 'PENDING_DISPATCH', 'PENDING_ACCEPT', 'PENDING_SERVICE'];

const list = ref<any[]>([]);
const loading = ref(false);
const actionLoading = ref(false);
const query = reactive({ status: '', keyword: '' });
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<any>(null);

const dispatchVisible = ref(false);
const dispatchTarget = ref<any>(null);
const selectedStaffId = ref('');
const staffOptions = ref<any[]>([]);

const cancelVisible = ref(false);
const cancelTarget = ref<any>(null);
const cancelReason = ref('');

function tagType(status: string) {
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELED' || status === 'REFUNDED') return 'info';
  if (status === 'PENDING_DISPATCH' || status === 'PENDING_PAYMENT') return 'warning';
  if (status === 'EXCEPTION' || status === 'AFTER_SALES') return 'danger';
  return 'primary';
}

function formatTime(value: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('zh-CN');
}

async function load(targetPage?: number) {
  if (targetPage) {
    page.value = targetPage;
  }

  loading.value = true;
  try {
    const result: any = await client.get('/admin/orders', {
      params: {
        status: query.status || undefined,
        keyword: query.keyword || undefined,
        page: page.value,
        pageSize: pageSize.value,
      },
    });
    list.value = result.list || [];
    total.value = result.total || 0;
  } catch (error: any) {
    ElMessage.error(error?.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function reset() {
  query.status = '';
  query.keyword = '';
  load(1);
}

async function openDetail(row: any) {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;

  try {
    detail.value = await client.get(`/admin/orders/${row.orderId}`);
  } catch (error: any) {
    ElMessage.error(error?.message || '加载详情失败');
  } finally {
    detailLoading.value = false;
  }
}

async function openDispatch(row: any) {
  dispatchTarget.value = row;
  selectedStaffId.value = '';
  dispatchVisible.value = true;

  if (staffOptions.value.length === 0) {
    try {
      staffOptions.value = (await client.get('/admin/staff')) as any;
    } catch (error: any) {
      ElMessage.error(error?.message || '加载保洁师失败');
    }
  }
}

async function confirmDispatch() {
  actionLoading.value = true;
  try {
    const result: any = await client.post(`/admin/orders/${dispatchTarget.value.orderId}/dispatch`, {
      staffId: selectedStaffId.value || undefined,
    });

    if (result.dispatched) {
      ElMessage.success(`已派给 ${result.staffName || '保洁师'}`);
    } else {
      ElMessage.warning('没有可用保洁师，订单仍在待派单');
    }

    dispatchVisible.value = false;
    load();
  } catch (error: any) {
    ElMessage.error(error?.message || '派单失败');
  } finally {
    actionLoading.value = false;
  }
}

function openCancel(row: any) {
  cancelTarget.value = row;
  cancelReason.value = '';
  cancelVisible.value = true;
}

async function confirmCancel() {
  if (!cancelReason.value.trim()) {
    ElMessage.warning('请填写取消原因');
    return;
  }

  try {
    await ElMessageBox.confirm('确认取消该订单？此操作会记录在审计日志中。', '二次确认');
  } catch {
    return;
  }

  actionLoading.value = true;
  try {
    const result: any = await client.post(`/admin/orders/${cancelTarget.value.orderId}/cancel`, {
      reason: cancelReason.value.trim(),
    });

    ElMessage.success(
      result.refundAmount > 0
        ? `已取消，生成退款单 ¥${(result.refundAmount / 100).toFixed(2)}`
        : '订单已取消',
    );

    cancelVisible.value = false;
    load();
  } catch (error: any) {
    ElMessage.error(error?.message || '取消失败');
  } finally {
    actionLoading.value = false;
  }
}

onMounted(() => load());
</script>

<style scoped>
.photo-block {
  margin-bottom: 12px;
}

.photo-label {
  font-size: 13px;
  color: #8a8f99;
  margin-bottom: 8px;
}

.photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.photo {
  width: 110px;
  height: 110px;
  border-radius: 6px;
  margin-right: 8px;
}

h4 {
  margin: 20px 0 10px;
}
</style>
