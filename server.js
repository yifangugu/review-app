const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/review-app';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== MongoDB 连接 ==========
const recordSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  productName: { type: String, required: true },
  investManager: { type: String, default: '' },
  categories: { type: [String], default: [] },
  urgency: { type: String, default: 'normal' },
  reason: { type: String, default: '' },
  communicated: { type: String, default: '' },
  additionalNote: { type: String, default: '' },
  submitterName: { type: String, default: '' },
  submitterDept: { type: String, default: '' },
  submitDate: { type: String, default: '' },
  status: { type: String, default: 'pending' },
  supplements: [{
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

const Record = mongoose.model('Record', recordSchema);

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB 连接成功');
  } catch (err) {
    console.error('MongoDB 连接失败:', err.message);
    process.exit(1);
  }
}

// ========== API 路由 ==========

// 获取所有记录
app.get('/api/records', async (req, res) => {
  try {
    const records = await Record.find().sort({ createdAt: -1 });
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取记录失败' });
  }
});

// 新增记录
app.post('/api/records', async (req, res) => {
  try {
    const body = req.body;

    // 生成 ID
    body.id = 'R' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
    body.status = body.status || 'pending';
    body.createdAt = body.createdAt || new Date();

    const record = new Record(body);
    await record.save();

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: '新增记录失败: ' + err.message });
  }
});

// 更新记录
app.put('/api/records/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;

    // 保留 id 和 createdAt
    const existing = await Record.findOne({ id });
    if (!existing) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    body.id = existing.id;
    body.createdAt = existing.createdAt;

    const updated = await Record.findOneAndUpdate({ id }, body, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: '更新记录失败' });
  }
});

// 删除记录
app.delete('/api/records/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await Record.findOneAndDelete({ id });

    if (!result) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: '删除记录失败' });
  }
});

// 更新状态
app.patch('/api/records/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    const record = await Record.findOneAndUpdate({ id }, { status }, { new: true });

    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: '更新状态失败' });
  }
});

// 按客户经理姓名查询记录
app.get('/api/records/by-submitter/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const records = await Record.find({ submitterName: name }).sort({ createdAt: -1 });
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: '查询记录失败' });
  }
});

// 追加补充说明
app.patch('/api/records/:id/supplement', async (req, res) => {
  try {
    const id = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: '补充内容不能为空' });
    }

    const record = await Record.findOne({ id });
    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    record.supplements = record.supplements || [];
    record.supplements.push({ content: content.trim(), createdAt: new Date() });
    await record.save();

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: '追加补充失败' });
  }
});

// 启动服务器
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器已启动: http://localhost:${PORT}`);
    console.log(`提报页面: http://localhost:${PORT}/review-submission.html`);
    console.log(`管理页面: http://localhost:${PORT}/review-admin.html`);
  });
});
