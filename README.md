# 家政清洁服务小程序

一个可以下单家政清洁服务的微信小程序，包含用户端、保洁师端、后端 API 与管理后台。

## 目录结构

```
home-cleaning/
├─ apps/
│  ├─ api/              # NestJS 后端
│  └─ miniprogram/      # 微信小程序（用户端 + 保洁师端）
├─ packages/
│  └─ shared/           # 前后端共享的类型、枚举、错误码
├─ infra/
│  └─ docker/           # 本地开发用的 MySQL / Redis
├─ docs/                # 设计文档、开发计划、决策记录
└─ .vscode/             # 编辑器配置
```

## 环境要求

- Node.js ≥ 20（当前使用 24）
- pnpm ≥ 9
- Docker Desktop（提供 MySQL 8.0 与 Redis 7）
- 微信开发者工具（开发小程序时使用）

## 快速开始

```bash
# 1. 启动数据库与缓存
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 2. 安装依赖
pnpm install

# 3. 构建共享包
pnpm --filter @hc/shared build

# 4. 初始化数据库
pnpm db:migrate
pnpm db:seed

# 5. 启动后端（默认 http://localhost:3000/api/v1）
pnpm dev
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动后端开发服务（热重载） |
| `pnpm build` | 构建共享包与后端 |
| `pnpm db:migrate` | 执行数据库迁移 |
| `pnpm db:seed` | 写入种子数据 |
| `pnpm db:studio` | 打开 Prisma 数据可视化界面 |
| `pnpm db:reset` | 重置数据库（会清空数据） |
| `pnpm format` | 格式化全部代码 |

## 文档

- `outputs/家政清洁服务小程序-设计文档.md` — 产品与系统设计
- `outputs/家政清洁服务小程序-代码项目开发计划书.md` — 工程实施方案
- `outputs/家政清洁服务小程序-MVP实施步骤与任务拆解.md` — 项目排期

## 开发约定

- 金额一律用 `bigint`，单位为**分**，禁止浮点运算。
- 订单状态流转必须通过 `OrderStatusService.transit()`，禁止直接 update status。
- 所有接口统一返回 `{ code, message, data, traceId }`，成功时 `code = 0`。
- 敏感信息（手机号、身份证）加密存储，日志中脱敏。
