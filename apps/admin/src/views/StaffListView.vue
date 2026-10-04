<template>
  <div class="page-card">
    <div class="toolbar">
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 160px" @change="load">
        <el-option label="待审核" value="PENDING" />
        <el-option label="正常" value="ACTIVE" />
        <el-option label="已暂停" value="PAUSED" />
        <el-option label="已封禁" value="BANNED" />
      </el-select>
      <el-button type="primary" @click="openCreate">新增保洁师</el-button>
      <el-button @click="load">刷新</el-button>
      <span class="tip">未通过审核的保洁师不会参与派单</span>
    </div>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="phone" label="手机号" width="140" />
      <el-table-column prop="level" label="等级" width="80" />
      <el-table-column prop="rating" label="评分" width="80" />
      <el-table-column prop="orderCount" label="累计单量" width="100" />
      <el-table-column label="接单率" width="100">
        <template #default="{ row }">{{ row.acceptRate }}%</template>
      </el-table-column>
      <el-table-column label="准时率" width="100">
        <template #default="{ row }">{{ row.onTimeRate }}%</template>
      </el-table-column>
      <el-table-column label="服务区域" min-width="160">
        <template #default="{ row }">{{ districtText(row) }}</template>
      </el-table-column>
      <el-table-column label="技能标签" min-width="160">
        <template #default="{ row }">{{ row.skillTags.join('、') || '-' }}</template>
      </el-table-column>
      <el-table-column label="每日上限" width="100">
        <template #default="{ row }">{{ row.maxDailyOrders }} 单</template>
      </el-table-column>
      <el-table-column label="分成" width="90">
        <template #default="{ row }">{{ row.settlementRate }}%</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="tagType(row.status)" size="small">
            {{ STATUS_TEXT[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'PENDING'"
            link
            type="primary"
            @click="changeStatus(row, 'ACTIVE', '审核通过')"
          >审核通过</el-button>
          <el-button
            v-if="row.status === 'ACTIVE'"
            link
            type="warning"
            @click="changeStatus(row, 'PAUSED', '暂停接单')"
          >暂停接单</el-button>
          <el-button
            v-if="row.status === 'PAUSED' || row.status === 'BANNED'"
            link
            type="success"
            @click="changeStatus(row, 'ACTIVE', '恢复接单')"
          >恢复接单</el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button
            v-if="row.status !== 'BANNED'"
            link
            type="danger"
            @click="changeStatus(row, 'BANNED', '封禁')"
          >封禁</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑保洁师' : '新增保洁师'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="姓名">
          <el-input v-model="form.name" placeholder="如：李阿姨" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="11 位手机号" />
        </el-form-item>
        <el-form-item v-if="!editingId" label="登录标识">
          <el-input v-model="form.openid" placeholder="开发阶段用登录码，如 staff_dev004" />
        </el-form-item>
        <el-form-item label="技能标签">
          <el-select v-model="form.skillTags" multiple style="width: 100%" placeholder="可多选">
            <el-option v-for="tag in SKILL_OPTIONS" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务区域">
          <el-select v-model="form.serviceDistricts" multiple style="width: 100%" placeholder="不选表示全城可服务">
            <el-option
              v-for="region in regions"
              :key="region.code"
              :label="region.name + (region.isServed ? '' : '（未开通）')"
              :value="region.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="每日上限">
          <el-input-number v-model="form.maxDailyOrders" :min="1" :max="20" />
        </el-form-item>
        <el-form-item label="分成比例">
          <el-input-number v-model="form.settlementRate" :min="0" :max="100" />
          <span class="tip" style="margin-left: 8px">%</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import client from '../api/client';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待审核',
  ACTIVE: '正常',
  PAUSED: '已暂停',
  BANNED: '已封禁',
};

const SKILL_OPTIONS = ['日常保洁', '深度保洁', '家电清洗', '开荒保洁'];

const list = ref<any[]>([]);
const regions = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);
const statusFilter = ref('');
const dialogVisible = ref(false);
const editingId = ref('');

const form = ref<any>({
  name: '',
  phone: '',
  openid: '',
  skillTags: [],
  serviceDistricts: [],
  maxDailyOrders: 4,
  settlementRate: 70,
});

function tagType(status: string) {
  if (status === 'ACTIVE') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'BANNED') return 'danger';
  return 'info';
}

function districtText(row: any) {
  const names = (row.serviceDistricts || []).map((code: string) => {
    const region = regions.value.find((item) => item.code === code);
    return region ? region.name : code;
  });
  return names.length > 0 ? names.join('、') : '全城';
}

async function load() {
  loading.value = true;
  try {
    const result: any = await client.get('/admin/staff', {
      params: { status: statusFilter.value || undefined },
    });
    list.value = (result || []).filter((row: any) =>
      statusFilter.value ? row.status === statusFilter.value : true,
    );
  } catch (error: any) {
    // 拦截器已提示
  } finally {
    loading.value = false;
  }
}

async function loadRegions() {
  try {
    regions.value = (await client.get('/admin/regions')) as any;
  } catch (error: any) {
    // 忽略：区域加载失败不影响其他操作
  }
}

function openCreate() {
  editingId.value = '';
  form.value = {
    name: '',
    phone: '',
    openid: '',
    skillTags: [],
    serviceDistricts: [],
    maxDailyOrders: 4,
    settlementRate: 70,
  };
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editingId.value = row.id;
  form.value = {
    name: row.name,
    phone: row.phone,
    openid: '',
    skillTags: row.skillTags || [],
    serviceDistricts: row.serviceDistricts || [],
    maxDailyOrders: row.maxDailyOrders,
    settlementRate: row.settlementRate,
  };
  dialogVisible.value = true;
}

async function submitForm() {
  if (!form.value.name || !form.value.phone) {
    ElMessage.warning('请填写姓名和手机号');
    return;
  }
  if (!editingId.value && !form.value.openid) {
    ElMessage.warning('请填写登录标识');
    return;
  }

  saving.value = true;

  try {
    if (editingId.value) {
      await client.put(`/admin/staff/${editingId.value}`, {
        name: form.value.name,
        phone: form.value.phone,
        skillTags: form.value.skillTags,
        serviceDistricts: form.value.serviceDistricts,
        maxDailyOrders: form.value.maxDailyOrders,
        settlementRate: form.value.settlementRate,
      });
      ElMessage.success('已保存');
    } else {
      await client.post('/admin/staff', form.value);
      ElMessage.success('已新增，请审核通过后开始接单');
    }

    dialogVisible.value = false;
    load();
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function changeStatus(row: any, status: string, label: string) {
  try {
    await ElMessageBox.confirm(`确认对「${row.name}」执行「${label}」？`, '操作确认');
  } catch {
    return;
  }

  try {
    await client.post(`/admin/staff/${row.id}/status`, { status, reason: label });
    ElMessage.success(`${label}成功`);
    load();
  } catch (error: any) {
    ElMessage.error(error?.message || '操作失败');
  }
}

onMounted(() => {
  loadRegions();
  load();
});
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.tip {
  color: #8a8f99;
  font-size: 13px;
}
</style>
