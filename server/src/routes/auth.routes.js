// 认证路由，挂在 /api/auth 下
const express = require('express');
const router = express.Router();
const asyncHandler = require('../middlewares/asyncHandler');
const { register, login } = require('../controllers/auth.controller');

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));

module.exports = router;
