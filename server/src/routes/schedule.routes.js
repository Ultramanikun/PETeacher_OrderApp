// 时段路由（老师专属操作），挂在 /api/teacher/schedules 下
const express = require('express');
const router = express.Router();
const asyncHandler = require('../middlewares/asyncHandler');
const { authRequired, teacherOnly } = require('../middlewares/auth');
const { createSchedule, deleteSchedule } = require('../controllers/schedule.controller');

// 发布时段
router.post('/', authRequired, teacherOnly, asyncHandler(createSchedule));
// 删除时段
router.delete('/:id', authRequired, teacherOnly, asyncHandler(deleteSchedule));

module.exports = router;
