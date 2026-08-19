// 包装异步控制器，自动把 Promise 里抛出的错误交给 Express 全局错误处理，
// 这样每个控制器就不用重复写 try/catch 了。
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
