# 产品运作复盘会提报系统

## 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 启动服务
npm start

# 3. 访问页面
# 提报页面: http://localhost:3000/review-submission.html
# 管理页面: http://localhost:3000/review-admin.html
```

## 系统说明

### 页面功能

| 页面 | 用途 | 访问地址 |
|------|------|----------|
| 提报页面 | 客户经理提交需要复盘的产品 | `/review-submission.html` |
| 管理页面 | 内部查看记录、编辑、改状态、统计分析 | `/review-admin.html` |

### 提报字段

- **产品名称**（必填）
- **投资经理**：王涛 / 邵骏腾 / 上官佳依 / 宋哲君
- **议题分类**：业绩不达预期 / 投资策略疑问 / 交易运营投诉 / 其他
- **紧急程度**：一般（可在复盘会中做常规运作讨论）/ 较急（客户不满，但仍愿意观察一段时间）/ 紧急（客户反馈较强烈，需要尽快响应）
- **提报原因**（必填）
- **是否已与投资经理沟通**：是，投资已沟通，但仍不能满足客户需求 / 否，客户拒绝单独沟通 / 否，需要协调最近可用的投资经理时间 / 其他
- **补充说明**
- **客户经理姓名**（必填）
- **所属部门**
- **提报日期**（自动填充）

### 状态流转

只有两种状态：
- **未复盘** (pending)
- **已复盘** (completed)

## 部署到线上

### 方案一：Render（推荐，免费）

1. 将 `review-app` 文件夹上传到 GitHub 仓库
2. 访问 [render.com](https://render.com)，注册并连接 GitHub
3. 新建 Web Service，选择该仓库
4. 配置：
   - Build Command: `npm install`
   - Start Command: `npm start`
   - 环境变量: 无需配置
5. 部署完成后获得线上地址，如 `https://review-app-xxxx.onrender.com`

### 方案二：Railway（免费额度）

1. 访问 [railway.app](https://railway.app)，注册并连接 GitHub
2. 新建项目 → 从 GitHub 部署
3. 配置 Start Command: `npm start`
4. 自动分配域名

### 方案三：公司内网服务器

```bash
# 上传 review-app 整个文件夹到服务器
scp -r review-app/ user@server:/path/to/

# SSH 登录服务器后
cd /path/to/review-app
npm install
npm start

# 如需后台运行（推荐使用 pm2）
npm install -g pm2
pm2 start server.js --name review-app
pm2 save
pm2 startup    # 开机自启
```

## 数据存储

当前使用 JSON 文件存储（`data/records.json`），适合小团队使用。

如需升级为数据库（如多人高并发场景），可替换 `server.js` 中的 `readRecords()` 和 `writeRecords()` 函数，接入 SQLite 或 MongoDB。

## 文件结构

```
review-app/
├── server.js              # Express 后端服务
├── package.json           # 项目配置
├── data/
│   └── records.json       # 数据存储（自动生成）
├── public/
│   ├── review-submission.html  # 提报页面
│   └── review-admin.html      # 管理页面
└── node_modules/          # 依赖包
```
