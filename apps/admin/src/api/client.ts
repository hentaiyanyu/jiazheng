import axios from 'axios';

const TOKEN_KEY = 'hc_admin_token';

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// 后端统一返回 { code, message, data, traceId }，这里直接取出 data
client.interceptors.response.use(
  (response) => {
    const body: any = response.data;

    if (body && typeof body.code === 'number') {
      if (body.code === 0) {
        return body.data;
      }

      if ([40100, 40101, 40102].indexOf(body.code) >= 0) {
        localStorage.removeItem(TOKEN_KEY);
        if (window.location.hash.indexOf('/login') < 0) {
          window.location.hash = '#/login';
        }
      }

      return Promise.reject(new Error(body.message || '请求失败'));
    }

    return body;
  },
  (error) => Promise.reject(new Error(error.message || '网络异常，请稍后重试')),
);

export { TOKEN_KEY };
export default client;
