// 认证与权限中间件
const { verifyToken } = require('../utils/jwt');
const { fail } = require('../utils/response');

// 必须登录：从请求头解析 token，校验后把 { id, role } 挂到 req.user 上
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return fail(res, 401, '未登录');

  try {
    req.user = verifyToken(token); // { id, role }
    next();
  } catch (err) {
    return fail(res, 401, 'token 无效或已过期');
  }
}

// 必须是老师：需在 authRequired 之后使用
function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return fail(res, 403, '需要老师权限');
  next();
}

module.exports = { authRequired, teacherOnly };
