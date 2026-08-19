// 统一响应格式封装：所有接口都返回 { code, message, data }
// code === 0 表示成功，非 0 表示失败。

// 成功响应
function ok(res, data = null, message = 'ok') {
  return res.json({ code: 0, message, data });
}

// 失败响应（code 与 HTTP 状态码保持一致）
function fail(res, code = 500, message = '服务器错误', data = null) {
  const status = code >= 400 && code < 600 ? code : 500;
  return res.status(status).json({ code, message, data });
}

module.exports = { ok, fail };
