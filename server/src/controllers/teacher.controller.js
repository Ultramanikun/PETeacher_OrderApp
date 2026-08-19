// 教师控制器：老师列表、老师详情、某老师的时段列表
const pool = require('../config/db');
const { ok, fail } = require('../utils/response');

// 老师列表（支持按 subject 筛选 + 分页）
async function listTeachers(req, res) {
  const { subject } = req.query;
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const offset = (page - 1) * pageSize;

  // 动态拼条件：占位符编号 $1、$2… 要按参数加入顺序递增
  const conditions = [];
  const params = [];
  if (subject) {
    params.push(subject);
    conditions.push(`subject = $${params.length}`);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  // 先查总数（COUNT 返回 bigint，::int 转成普通整数）
  const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM teachers ${where}`, params);
  // 再查当前页数据（LIMIT/OFFSET 的占位符接着编号）
  const listRes = await pool.query(
    `SELECT id, name, subject, intro, avatar, created_at
     FROM teachers ${where}
     ORDER BY id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset]
  );

  return ok(res, { total: totalRes.rows[0].total, list: listRes.rows });
}

// 老师详情（连带该老师所有可预约时段）
async function getTeacher(req, res) {
  const { id } = req.params;

  const { rows: teachers } = await pool.query(
    'SELECT id, name, subject, intro, avatar, created_at FROM teachers WHERE id = $1',
    [id]
  );
  if (teachers.length === 0) return fail(res, 404, '老师不存在');

  const teacher = teachers[0];

  // 查时段，LEFT JOIN 统计每个时段「已确认」的预约数（booked）
  // 注意：PostgreSQL 的 GROUP BY 更严格，SELECT 里的非聚合字段都要写进 GROUP BY
  const { rows: schedules } = await pool.query(
    `SELECT s.id, s.date, s.start_time, s.end_time, s.capacity, s.status,
            COUNT(a.id)::int AS booked
     FROM schedules s
     LEFT JOIN appointments a ON a.schedule_id = s.id AND a.status = 'confirmed'
     WHERE s.teacher_id = $1
     GROUP BY s.id, s.date, s.start_time, s.end_time, s.capacity, s.status
     ORDER BY s.date, s.start_time`,
    [id]
  );

  teacher.schedules = schedules;
  return ok(res, teacher);
}

// 某老师的时段列表（公开，学生预约前查看用）
async function listTeacherSchedules(req, res) {
  const { teacherId } = req.params;
  const { date } = req.query;

  const conditions = ['s.teacher_id = $1'];
  const params = [teacherId];
  if (date) {
    params.push(date);
    conditions.push(`s.date = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT s.id, s.date, s.start_time, s.end_time, s.capacity, s.status,
            COUNT(a.id)::int AS booked
     FROM schedules s
     LEFT JOIN appointments a ON a.schedule_id = s.id AND a.status = 'confirmed'
     WHERE ${conditions.join(' AND ')}
     GROUP BY s.id, s.date, s.start_time, s.end_time, s.capacity, s.status
     ORDER BY s.date, s.start_time`,
    params
  );

  return ok(res, rows);
}

module.exports = { listTeachers, getTeacher, listTeacherSchedules };
