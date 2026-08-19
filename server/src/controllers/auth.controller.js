// 认证控制器：注册、登录
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { signToken } = require('../utils/jwt');
const { ok, fail } = require('../utils/response');

// 注册
async function register(req, res) {
  const { account, password, name, role = 'student', subject = '' } = req.body;

  // 1. 基础校验
  if (!account || !password || !name) return fail(res, 400, '账号、密码、姓名都必填');
  if (!['student', 'teacher'].includes(role)) return fail(res, 400, 'role 只能是 student 或 teacher');

  // 2. 检查账号是否已存在（pg 的占位符是 $1，不是 ?）
  const { rows: exists } = await pool.query('SELECT id FROM users WHERE account = $1', [account]);
  if (exists.length > 0) return fail(res, 409, '账号已存在');

  // 3. 密码加密（bcrypt 哈希，绝不存明文）
  const hashed = await bcrypt.hash(password, 10);

  // 4. 写入数据库：用事务保证「建用户 + 建教师资料」要么都成功、要么都回滚
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // INSERT ... RETURNING id 直接拿到自增 id（pg 没有 insertId）
    const result = await client.query(
      'INSERT INTO users (account, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [account, hashed, name, role]
    );
    const userId = result.rows[0].id;

    // 老师账号：同时在 teachers 表建一条资料
    if (role === 'teacher') {
      await client.query(
        'INSERT INTO teachers (user_id, name, subject, intro) VALUES ($1, $2, $3, $4)',
        [userId, name, subject, '']
      );
    }

    await client.query('COMMIT');

    // 5. 签发 token 并返回
    const token = signToken({ id: userId, role });
    return ok(res, { token, user: { id: userId, account, name, role } });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err; // 交给 asyncHandler → 全局错误处理
  } finally {
    client.release();
  }
}

// 登录
async function login(req, res) {
  const { account, password } = req.body;

  if (!account || !password) return fail(res, 400, '账号和密码都必填');

  // 1. 按账号查用户
  const { rows } = await pool.query('SELECT * FROM users WHERE account = $1', [account]);
  if (rows.length === 0) return fail(res, 401, '账号或密码错误');

  const user = rows[0];

  // 2. 比对密码（bcrypt.compare，不能直接字符串比较）
  const match = await bcrypt.compare(password, user.password);
  if (!match) return fail(res, 401, '账号或密码错误');

  // 3. 签发 token
  const token = signToken({ id: user.id, role: user.role });
  return ok(res, {
    token,
    user: { id: user.id, account: user.account, name: user.name, role: user.role },
  });
}

module.exports = { register, login };
