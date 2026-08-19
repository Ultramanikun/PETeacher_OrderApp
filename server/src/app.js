// 后端入口：加载配置、挂载中间件和路由、启动服务
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const teacherRoutes = require('./routes/teacher.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const { studentRouter, teacherRouter } = require('./routes/appointment.routes');
const { fail } = require('./utils/response');

const app = express();

// 全局中间件
app.use(cors());           // 允许跨域（前端 H5 调后端要用）
app.use(express.json());   // 解析 JSON 请求体

// 健康检查（确认服务是否活着）
app.get('/api/health', (req, res) => res.json({ code: 0, message: 'ok', data: 'peteacher server running' }));

// 业务路由
app.use('/api/auth', authRoutes);                          // 注册 / 登录
app.use('/api/teachers', teacherRoutes);                   // 老师列表 / 详情 / 时段列表
app.use('/api/teacher/schedules', scheduleRoutes);         // 老师发布 / 删除时段
app.use('/api/appointments', studentRouter);               // 学生预约相关
app.use('/api/teacher/appointments', teacherRouter);       // 老师查看 / 处理预约

// 404：没有匹配到任何路由
app.use((req, res) => fail(res, 404, '接口不存在'));

// 全局错误处理（4 个参数，Express 才识别为错误中间件）
app.use((err, req, res, next) => {
  console.error(err);
  fail(res, 500, '服务器内部错误：' + err.message);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 后端已启动：http://localhost:${PORT}`);
  console.log(`   健康检查：http://localhost:${PORT}/api/health`);
});

module.exports = app;
