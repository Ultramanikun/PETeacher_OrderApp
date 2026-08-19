// PostgreSQL 连接池（node-postgres / pg）
// 整个项目共用这一个连接池，不要每次查询都新建连接。
require('dotenv').config();

const { Pool, types } = require('pg');

// 让 DATE / TIMESTAMP 以字符串返回（如 '2026-09-10'、'2026-09-10 14:00:00'），
// 避免 pg 默认把它们解析成带时区的 JS Date 对象导致显示错乱。
types.setTypeParser(1082, (val) => val); // DATE
types.setTypeParser(1114, (val) => val); // TIMESTAMP (without time zone)

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'peteacher',
});

module.exports = pool;
