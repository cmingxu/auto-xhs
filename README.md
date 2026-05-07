# auto-xhs

小红书自动化工具，通过 Chrome 扩展模拟真实用户浏览行为，配合 Go 后端存储数据并提供可视化管理面板。

## 核心功能

### Chrome 扩展（自动化引擎）

- **搜索模拟** — 逐字输入关键词到小红书搜索框，模拟真实打字行为
- **Feed 浏览** — 自动滚动搜索结果页，加载更多内容
- **随机点击** — 从搜索结果中随机选取帖子点开详情
- **内容采集** — 抓取笔记标题、正文、标签、日期、ID 等 DOM 数据
- **评论采集** — 滚动评论区并通过 API 拦截 + DOM 提取两种方式获取评论数据
- **用户数据采集** — 悬停评论者头像触发 hover_card API 调用，拦截获取用户资料
- **自动关注** — 检测关注按钮并自动关注作者（支持每日上限）
- **AI 评论生成** — 接入 DeepSeek API，根据笔记标题和正文自动生成符合语境的评论
- **自动发评** — 模拟输入并提交评论（支持去重和每日上限）
- **自动点赞** — 随机点赞评论（同用户单日去重）
- **循环执行** — 所有关键词完成后可按设定间隔重新开始
- **数据同步** — 每 30 秒将采集数据 POST 到后端

### Go 后端（数据存储 + 管理面板）

- **REST API** — 基于 Gin 框架，接收扩展同步的数据
- **认证系统** — 基于 Cookie 的会话认证，默认账号 admin/admin
- **SQLite / PostgreSQL** — 支持两种数据库，默认 SQLite 零配置启动
- **React 管理面板** — 内嵌 SPA，提供数据查看、删除、统计功能
- **单个二进制部署** — 前端资源编译时嵌入，一个文件即可运行

## 项目结构

```
auto-xhs/
├── cmd/auto-xhs/main.go          # 服务入口
├── internal/
│   ├── admin/admin.go            # HTTP 路由与认证
│   ├── config/config.go          # 环境变量配置
│   ├── db/db.go                  # GORM 数据访问层
│   └── models/                   # 数据模型
│       ├── xhs_user.go           # 小红书用户
│       ├── note.go               # 笔记
│       ├── comment.go            # 评论
│       └── ai_comment.go         # AI 生成的评论
├── webui/                        # 前端嵌入层
│   └── dist/                     # React 构建产物
├── web/                          # React 前端源码（TypeScript + Vite + TailwindCSS）
├── chrome-extension/             # Chrome 扩展（Manifest V3）
│   ├── background.js             # Service Worker：状态机 + 同步定时器
│   ├── popup/                    # 扩展弹窗 UI
│   ├── options/                  # 设置页面
│   └── content/                  # 内容脚本
│       ├── content.js            # 主流程编排
│       ├── core/                 # 状态管理 / 工具函数 / API 拦截
│       └── actions/              # 搜索 / Feed / 详情 / 关注 / 评论 / 点赞
├── auto-xhs.service              # systemd 服务文件
├── Makefile
└── go.mod
```

## 快速开始

### 1. 启动后端

```bash
# 开发模式（前端从磁盘读取）
make dev

# 或直接运行
go run ./cmd/auto-xhs
```

默认监听 `:7072`，使用 SQLite（自动创建 `var/db/app.sqlite`）。

默认管理员账号：`admin` / `admin`

### 2. 安装 Chrome 扩展

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `chrome-extension/` 目录

### 3. 配置扩展

点击扩展图标 → 设置，配置以下内容：

- **后端地址**：填入 Go 服务的地址（如 `http://localhost:7072`）
- **搜索关键词**：逗号分隔，如 `穿搭, 旅行, 美食`
- **DeepSeek API Key**（可选）：启用 AI 评论生成
- **每日上限**：关注数 / 评论数 / 点赞数

### 4. 使用

点击扩展图标，点击「开始」按钮，扩展会自动在小红书页面执行搜索和浏览。采集的数据可在后端管理面板 `http://localhost:7072` 查看。

## 构建

```bash
make build          # macOS
make build-linux    # Linux amd64
make build-all      # 所有平台
```

构建时会先编译前端（`cd web && npm run build`），再将产物嵌入 Go 二进制。

## 部署

```bash
make deploy
```

会自动构建 Linux 二进制并通过 SCP 部署到远程服务器，安装 systemd 服务。部署目标在 Makefile 中配置。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `ADMIN_ADDR` | `:7072` | HTTP 监听地址 |
| `DB_DRIVER` | `sqlite` | 数据库驱动（`sqlite` / `pgx`） |
| `DB_DSN` | `var/db/app.sqlite` | 数据库连接串 |
| `DATABASE_URL` | - | PostgreSQL 连接地址，设置后自动使用 pgx 驱动 |

## 技术栈

- **后端**：Go / Gin / GORM / SQLite / PostgreSQL
- **前端**：React / TypeScript / Vite / TailwindCSS
- **扩展**：Chrome Extension Manifest V3 / 原生 JavaScript
- **AI**：DeepSeek API
