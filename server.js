const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/review-app';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== 存储模式标志 ==========
let useMemoryStore = false;

// ========== 内存存储 ==========
let memoryRecords = [];
let memoryUsers = []; // { username, passwordHash, department, createdAt }
let memorySessions = {}; // token -> username

// ========== 工具函数 ==========
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_review_salt_2026').digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ========== MongoDB Schema ==========
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

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  department: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // 24小时自动过期
});

const Record = mongoose.model('Record', recordSchema);
const User = mongoose.model('User', userSchema);
const Session = mongoose.model('Session', sessionSchema);

// ========== 连接 MongoDB ==========
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000
    });
    console.log('✅ MongoDB 连接成功');
    return true;
  } catch (err) {
    console.warn('⚠️  MongoDB 连接失败:', err.message);
    console.warn('⚠️  回退到内存存储模式（数据仅保存在内存中，重启后丢失）');
    useMemoryStore = true;
    return false;
  }
}

// ========== 认证中间件 ==========
async function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: '请先登录' });
  }

  try {
    if (useMemoryStore) {
      const username = memorySessions[token];
      if (!username) return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
      req.currentUser = username;
      const user = memoryUsers.find(u => u.username === username);
      req.currentUserDept = user ? user.department : '';
      return next();
    }

    const session = await Session.findOne({ token });
    if (!session) return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
    req.currentUser = session.username;
    const user = await User.findOne({ username: session.username });
    req.currentUserDept = user ? user.department : '';
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: '认证失败' });
  }
}

// ========== 辅助函数：内存模式下的操作 ==========
function memoryFindOne(id) {
  return memoryRecords.find(r => r.id === id) || null;
}

// ========== 认证 API ==========

// 注册（首次登录自定义密码）
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, department } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: '请输入姓名' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ success: false, message: '密码至少4位' });
    }

    const name = username.trim();
    const passwordHash = hashPassword(password);

    if (useMemoryStore) {
      const existing = memoryUsers.find(u => u.username === name);
      if (existing) {
        return res.status(400).json({ success: false, message: '该姓名已注册，请直接登录' });
      }
      memoryUsers.push({ username: name, passwordHash, department: department || '', createdAt: new Date() });
      const token = generateToken();
      memorySessions[token] = name;
      return res.json({ success: true, data: { token, username: name, department: department || '' } });
    }

    const existing = await User.findOne({ username: name });
    if (existing) {
      return res.status(400).json({ success: false, message: '该姓名已注册，请直接登录' });
    }

    await new User({ username: name, passwordHash, department: department || '' }).save();
    const token = generateToken();
    await new Session({ token, username: name }).save();

    res.json({ success: true, data: { token, username: name, department: department || '' } });
  } catch (err) {
    res.status(500).json({ success: false, message: '注册失败: ' + err.message });
  }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请输入姓名和密码' });
    }

    const name = username.trim();
    const passwordHash = hashPassword(password);

    if (useMemoryStore) {
      const user = memoryUsers.find(u => u.username === name && u.passwordHash === passwordHash);
      if (!user) {
        return res.status(401).json({ success: false, message: '姓名或密码错误' });
      }
      const token = generateToken();
      memorySessions[token] = name;
      return res.json({ success: true, data: { token, username: name, department: user.department } });
    }

    const user = await User.findOne({ username: name, passwordHash });
    if (!user) {
      return res.status(401).json({ success: false, message: '姓名或密码错误' });
    }

    const token = generateToken();
    await new Session({ token, username: name }).save();

    res.json({ success: true, data: { token, username: name, department: user.department } });
  } catch (err) {
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 验证 token
app.get('/api/auth/verify', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.json({ success: false, message: '未登录' });

  try {
    if (useMemoryStore) {
      const username = memorySessions[token];
      if (!username) return res.json({ success: false, message: '登录已过期' });
      const user = memoryUsers.find(u => u.username === username);
      return res.json({ success: true, data: { username, department: user?.department || '' } });
    }

    const session = await Session.findOne({ token });
    if (!session) return res.json({ success: false, message: '登录已过期' });
    const user = await User.findOne({ username: session.username });
    res.json({ success: true, data: { username: session.username, department: user?.department || '' } });
  } catch (err) {
    res.json({ success: false, message: '验证失败' });
  }
});

// 登出
app.post('/api/auth/logout', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.json({ success: true });

  try {
    if (useMemoryStore) {
      delete memorySessions[token];
      return res.json({ success: true });
    }
    await Session.deleteOne({ token });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: true });
  }
});

// 获取所有用户（管理页面用）
app.get('/api/users', async (req, res) => {
  try {
    if (useMemoryStore) {
      const users = memoryUsers.map(u => ({ username: u.username, department: u.department, createdAt: u.createdAt }));
      return res.json({ success: true, data: users });
    }
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

// 更新用户部门（管理页面用）
app.put('/api/users/:username/department', async (req, res) => {
  try {
    const username = req.params.username;
    const { department } = req.body;

    if (!department || !department.trim()) {
      return res.status(400).json({ success: false, message: '部门不能为空' });
    }

    if (useMemoryStore) {
      const user = memoryUsers.find(u => u.username === username);
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
      user.department = department.trim();
      // 同步更新该用户所有提报记录的部门
      memoryRecords.forEach(r => {
        if (r.submitterName === username) {
          r.submitterDept = department.trim();
        }
      });
      return res.json({ success: true, data: { username: user.username, department: user.department } });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    user.department = department.trim();
    await user.save();
    // 同步更新该用户所有提报记录的部门
    await Record.updateMany(
      { submitterName: username },
      { submitterDept: department.trim() }
    );
    res.json({ success: true, data: { username: user.username, department: user.department } });
  } catch (err) {
    res.status(500).json({ success: false, message: '更新用户部门失败' });
  }
});

// ========== 业务 API（部分需要认证）==========

// 新增记录（需要登录）
app.post('/api/records', authMiddleware, async (req, res) => {
  try {
    const body = { ...req.body };
    body.id = 'R' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
    body.status = body.status || 'pending';
    body.createdAt = body.createdAt || new Date();
    body.supplements = body.supplements || [];
    // 强制使用登录用户名作为提报人
    body.submitterName = req.currentUser;
    // 强制使用用户注册的部门（防止客户端传参跨部门）
    const userDept = req.currentUserDept;
    if (userDept) {
      body.submitterDept = userDept;
    }

    if (useMemoryStore) {
      memoryRecords.push(body);
      return res.json({ success: true, data: body });
    }

    const record = new Record(body);
    await record.save();
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: '新增记录失败: ' + err.message });
  }
});

// 获取所有记录（管理页面，无需认证）
app.get('/api/records', async (req, res) => {
  try {
    if (useMemoryStore) {
      const sorted = [...memoryRecords].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ success: true, data: sorted });
    }
    const records = await Record.find().sort({ createdAt: -1 });
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取记录失败' });
  }
});

// 按客户经理姓名查询记录（需要认证，只能查自己）
app.get('/api/records/by-submitter/:name', authMiddleware, async (req, res) => {
  try {
    // 只允许查询自己的记录
    const name = req.currentUser;

    if (useMemoryStore) {
      const records = memoryRecords
        .filter(r => r.submitterName === name)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ success: true, data: records });
    }

    const records = await Record.find({ submitterName: name }).sort({ createdAt: -1 });
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: '查询记录失败' });
  }
});

// 追加补充说明（需要认证，只能补充自己的）
app.patch('/api/records/:id/supplement', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: '补充内容不能为空' });
    }

    if (useMemoryStore) {
      const record = memoryFindOne(id);
      if (!record) return res.status(404).json({ success: false, message: '记录不存在' });
      if (record.submitterName !== req.currentUser) {
        return res.status(403).json({ success: false, message: '只能补充自己的记录' });
      }
      record.supplements = record.supplements || [];
      record.supplements.push({ content: content.trim(), createdAt: new Date() });
      return res.json({ success: true, data: record });
    }

    const record = await Record.findOne({ id });
    if (!record) return res.status(404).json({ success: false, message: '记录不存在' });
    if (record.submitterName !== req.currentUser) {
      return res.status(403).json({ success: false, message: '只能补充自己的记录' });
    }
    record.supplements = record.supplements || [];
    record.supplements.push({ content: content.trim(), createdAt: new Date() });
    await record.save();
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: '追加补充失败' });
  }
});

// 更新记录（管理页面用，无需认证）
app.put('/api/records/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = { ...req.body };

    if (useMemoryStore) {
      const idx = memoryRecords.findIndex(r => r.id === id);
      if (idx === -1) return res.status(404).json({ success: false, message: '记录不存在' });
      body.id = memoryRecords[idx].id;
      body.createdAt = memoryRecords[idx].createdAt;
      memoryRecords[idx] = body;
      return res.json({ success: true, data: body });
    }

    const existing = await Record.findOne({ id });
    if (!existing) return res.status(404).json({ success: false, message: '记录不存在' });
    body.id = existing.id;
    body.createdAt = existing.createdAt;
    const updated = await Record.findOneAndUpdate({ id }, body, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: '更新记录失败' });
  }
});

// 删除记录（管理页面用，无需认证）
app.delete('/api/records/:id', async (req, res) => {
  try {
    const id = req.params.id;

    if (useMemoryStore) {
      const idx = memoryRecords.findIndex(r => r.id === id);
      if (idx === -1) return res.status(404).json({ success: false, message: '记录不存在' });
      memoryRecords.splice(idx, 1);
      return res.json({ success: true });
    }

    const result = await Record.findOneAndDelete({ id });
    if (!result) return res.status(404).json({ success: false, message: '记录不存在' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: '删除记录失败' });
  }
});

// 更新状态（管理页面用，无需认证）
app.patch('/api/records/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    if (useMemoryStore) {
      const record = memoryFindOne(id);
      if (!record) return res.status(404).json({ success: false, message: '记录不存在' });
      record.status = status;
      return res.json({ success: true, data: record });
    }

    const record = await Record.findOneAndUpdate({ id }, { status }, { new: true });
    if (!record) return res.status(404).json({ success: false, message: '记录不存在' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: '更新状态失败' });
  }
});

// ========== 启动服务器 ==========
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 服务器已启动: http://localhost:${PORT}`);
    console.log(`📝 提报页面: http://localhost:${PORT}/review-submission.html`);
    console.log(`⚙️  管理页面: http://localhost:${PORT}/review-admin.html`);
    if (useMemoryStore) {
      console.log(`\n⚠️  当前为内存存储模式，数据仅保存在内存中，服务器重启后将丢失`);
      console.log(`⚠️  如需持久化存储，请配置 MONGODB_URI 环境变量\n`);
    }
  });
});
