// JWT 签发与校验
const jwt = require('jsonwebtoken');

// 签发 token：把用户 id 和 role 写进 token 里
function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// 校验 token：成功返回 { id, role }，失败抛异常
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
