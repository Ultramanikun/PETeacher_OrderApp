// 教师路由，挂在 /api/teachers 下（都是公开接口）
const express = require('express');
const router = express.Router();
const asyncHandler = require('../middlewares/asyncHandler');
const { listTeachers, getTeacher, listTeacherSchedules } = require('../controllers/teacher.controller');

// 老师列表
router.get('/', asyncHandler(listTeachers));
// 某老师的时段列表（注意：两段路径，要写在 GET /:id 之前，避免被 :id 抢掉）
router.get('/:teacherId/schedules', asyncHandler(listTeacherSchedules));
// 老师详情（含时段）
router.get('/:id', asyncHandler(getTeacher));

module.exports = router;
