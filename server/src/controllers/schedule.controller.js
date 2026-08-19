// 时段控制器：老师发布时段、删除时段（老师专属操作）
const pool = require('../config/db');
const { ok, fail } = require('../utils/response');

// 工具：根据当前登录用户 id（req.user.id）查出对应的 teachers.id
async function getTeacherIdByUserId(userId) {
  const { rows } = await pool.query('SELECT id FROM teachers WHERE user_id = $1', [userId]);
  return rows.length ? rows[0].id : null;
}

// 老师发布可预约时段
async function createSchedule(req, res) {
  const { date, start_time, end_time, capacity = 1 } = req.body;

  if (!date || !start_time || !end_time) return fail(res, 400, '日期、开始时间、结束时间都必填');

  const teacherId = await getTeacherIdByUserId(req.user.id);
  if (!teacherId) return fail(res, 404, '未找到你的教师资料');

  // INSERT ... RETURNING * 直接返回刚插入的整行
  const result = await pool.query(
    'INSERT INTO schedules (teacher_id, date, start_time, end_time, capacity) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [teacherId, date, start_time, end_time, capacity]
  );

  return ok(res, result.rows[0]);
}

// 老师删除时段（只能删自己的）
async function deleteSchedule(req, res) {
  const { id } = req.params;

  const teacherId = await getTeacherIdByUserId(req.user.id);
  if (!teacherId) return fail(res, 404, '未找到你的教师资料');

  // pg 里判断是否删到行，用 rowCount（不是 mysql2 的 affectedRows）
  const result = await pool.query(
    'DELETE FROM schedules WHERE id = $1 AND teacher_id = $2',
    [id, teacherId]
  );
  if (result.rowCount === 0) return fail(res, 404, '时段不存在或不属于你');

  return ok(res, null, '删除成功');
}

module.exports = { createSchedule, deleteSchedule };
