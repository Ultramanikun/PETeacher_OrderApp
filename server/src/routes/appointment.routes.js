// 预约路由：导出两个 router
//   studentRouter 挂在 /api/appointments（学生端）
//   teacherRouter 挂在 /api/teacher/appointments（老师端）
const express = require('express');
const studentRouter = express.Router();
const teacherRouter = express.Router();

const asyncHandler = require('../middlewares/asyncHandler');
const { authRequired, teacherOnly } = require('../middlewares/auth');
const ctrl = require('../controllers/appointment.controller');

// ---------- 学生端 ----------
studentRouter.post('/', authRequired, asyncHandler(ctrl.createAppointment));       // 创建预约
studentRouter.get('/mine', authRequired, asyncHandler(ctrl.myAppointments));       // 我的预约
studentRouter.delete('/:id', authRequired, asyncHandler(ctrl.cancelAppointment));  // 取消预约

// ---------- 老师端 ----------
teacherRouter.get('/', authRequired, teacherOnly, asyncHandler(ctrl.teacherAppointments));       // 查看我的预约
teacherRouter.patch('/:id', authRequired, teacherOnly, asyncHandler(ctrl.updateAppointmentStatus)); // 确认/取消

module.exports = { studentRouter, teacherRouter };
