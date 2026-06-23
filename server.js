const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'records.json');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 确保数据目录和文件存在
function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
  }
}

// 读取所有记录
function readRecords() {
  ensureDataFile();
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// 写入所有记录
function writeRecords(records) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

// ========== API 路由 ==========

// 获取所有记录
app.get('/api/records', (req, res) => {
  const records = readRecords();
  res.json({ success: true, data: records });
});

// 新增记录
app.post('/api/records', (req, res) => {
  const records = readRecords();
  const record = req.body;

  // 生成 ID
  record.id = 'R' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
  record.status = record.status || 'pending';
  record.createdAt = record.createdAt || new Date().toISOString();

  records.push(record);
  writeRecords(records);

  res.json({ success: true, data: record });
});

// 更新记录
app.put('/api/records/:id', (req, res) => {
  const records = readRecords();
  const id = req.params.id;
  const index = records.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: '记录不存在' });
  }

  // 保留 id 和 createdAt
  const updated = { ...req.body, id: records[index].id, createdAt: records[index].createdAt };
  records[index] = updated;
  writeRecords(records);

  res.json({ success: true, data: updated });
});

// 删除记录
app.delete('/api/records/:id', (req, res) => {
  const records = readRecords();
  const id = req.params.id;
  const index = records.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: '记录不存在' });
  }

  records.splice(index, 1);
  writeRecords(records);

  res.json({ success: true });
});

// 批量更新状态
app.patch('/api/records/:id/status', (req, res) => {
  const records = readRecords();
  const id = req.params.id;
  const { status } = req.body;
  const index = records.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: '记录不存在' });
  }

  records[index].status = status;
  writeRecords(records);

  res.json({ success: true, data: records[index] });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器已启动: http://localhost:${PORT}`);
  console.log(`提报页面: http://localhost:${PORT}/review-submission.html`);
  console.log(`管理页面: http://localhost:${PORT}/review-admin.html`);
});
