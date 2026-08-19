// 预约控制器：学生创建/查看/取消预约，老师查看/处理预约
const pool = require('../config/db');
const { ok, fail } = require('../utils/response');

// 学生创建预约
async function createAppointment(req, res) {
  const { schedule_id } = req.body;
  if (!schedule_id) return fail(res, 400, '缺少 schedule_id');

  // 1. 查时段是否存在
  const { rows: schedules } = await pool.query('SELECT * FROM schedules WHERE id = $1', [schedule_id]);
  if (schedules.length === 0) return fail(res, 404, '时段不存在');
  const schedule = schedules[0];

  if (schedule.status !== 'open') return fail(res, 409, '该时段已关闭');

  // 2. 名额判断：已确认预约数 >= capacity 则满
  const bookedRes = await pool.query(
    "SELECT COUNT(*)::int AS cnt FROM appointments WHERE schedule_id = $1 AND status = 'confirmed'",
    [schedule_id]
  );
  if (bookedRes.rows[0].cnt >= schedule.capacity) return fail(res, 409, '名额已满');

  // 3. 重复预约判断（未取消的才算重复）
  const dupRes = await pool.query(
    "SELECT id FROM appointments WHERE student_id = $1 AND schedule_id = $2 AND status != 'cancelled'",
    [req.user.id, schedule_id]
  );
  if (dupRes.rows.length > 0) return fail(res, 409, '你已经预约过这个时段');

  // 4. 写入预约
  const result = await pool.query(
    'INSERT INTO appointments (student_id, schedule_id) VALUES ($1, $2) RETURNING *',
    [req.user.id, schedule_id]
  );

  return ok(res, result.rows[0], '预约成功');
}

// 学生查看「我的预约」
async function myAppointments(req, res) {
  const { rows } = await pool.query(
    `SELECT a.id, a.status, a.created_at,
            s.id AS schedule_id, s.date, s.start_time, s.end_time,
            t.id AS teacher_id, t.name AS teacher_name, t.subject
     FROM appointments a
     JOIN schedules s ON a.schedule_id = s.id
     JOIN teachers t ON s.teacher_id = t.id
     WHERE a.student_id = $1
     ORDER BY a.created_at DESC`,
    [req.user.id]
  );

  // 重构成「嵌套结构」，方便前端直接渲染
  const data = rows.map((r) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    schedule: { id: r.schedule_id, date: r.date, start_time: r.start_time, end_time: r.end_time },
    teacher: { id: r.teacher_id, name: r.teacher_name, subject: r.subject },
  }));

  return ok(res, data);
}

// 学生取消预约（软删除：把状态改成 cancelled，不真删行）
async function cancelAppointment(req, res) {
  const { id } = req.params;

  const result = await pool.query(
    "UPDATE appointments SET status = 'cancelled' WHERE id = $1 AND student_id = $2 AND status != 'cancelled'",
    [id, req.user.id]
  );
  if (result.rowCount === 0) return fail(res, 404, '预约不存在或不可取消');

  return ok(res, null, '已取消');
}

// 老师查看「我的预约」（所有时段下的预约）
async function teacherAppointments(req, res) {
  const { rows: teacherRows } = await pool.query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
  if (teacherRows.length === 0) return fail(res, 404, '未找到你的教师资料');
  const teacherId = teacherRows[0].id;

  const { rows } = await pool.query(
    `SELECT a.id, a.status, a.created_at,
            u.id AS student_id, u.name AS student_name,
            s.id AS schedule_id, s.date, s.start_time, s.end_time
     FROM appointments a
     JOIN schedules s ON a.schedule_id = s.id
     JOIN users u ON a.student_id = u.id
     WHERE s.teacher_id = $1
     ORDER BY a.created_at DESC`,
    [teacherId]
  );

  const data = rows.map((r) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    student: { id: r.student_id, name: r.student_name },
    schedule: { id: r.schedule_id, date: r.date, start_time: r.start_time, end_time: r.end_time },
  }));

  return ok(res, data);
}

// 老师确认 / 取消预约（只能操作属于自己时段的预约）
async function updateAppointmentStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!['confirmed', 'cancelled'].includes(status)) {
    return fail(res, 400, 'status 只能是 confirmed 或 cancelled');
  }

  const { rows: teacherRows } = await pool.query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
  if (teacherRows.length === 0) return fail(res, 404, '未找到你的教师资料');
  const teacherId = teacherRows[0].id;

  // PostgreSQL 的「更新并关联另一张表」用 UPDATE ... FROM ... WHERE，
  // 不是 MySQL 的 UPDATE ... JOIN
  const result = await pool.query(
    `UPDATE appointments a
     SET status = $1
     FROM schedules s
     WHERE a.schedule_id = s.id AND a.id = $2 AND s.teacher_id = $3`,
    [status, id, teacherId]
  );
  if (result.rowCount === 0) return fail(res, 404, '预约不存在或不属于你的时段');

  return ok(res, { id: Number(id), status });
}

module.exports = {
  createAppointment,
  myAppointments,
  cancelAppointment,
  teacherAppointments,
  updateAppointmentStatus,
};
