import { createRouter, createWebHashHistory } from 'vue-router';
import { TOKEN_KEY } from '../api/client';
import AppLayout from '../layout/AppLayout.vue';
import DashboardView from '../views/DashboardView.vue';
import LoginView from '../views/LoginView.vue';
import OrderListView from '../views/OrderListView.vue';
import RefundListView from '../views/RefundListView.vue';
import StaffListView from '../views/StaffListView.vue';

const routes = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: DashboardView },
      { path: 'orders', name: 'orders', component: OrderListView },
      { path: 'staff', name: 'staff', component: StaffListView },
      { path: 'refunds', name: 'refunds', component: RefundListView },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!to.meta.public && !token) {
    return { path: '/login' };
  }
  if (to.path === '/login' && token) {
    return { path: '/dashboard' };
  }
  return true;
});

export default router;
