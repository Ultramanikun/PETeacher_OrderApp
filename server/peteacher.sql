-- 体育教师预约小程序 · 建表脚本（PostgreSQL 版）
--
-- 用法（二选一）：
--   1) DBeaver：连上 PostgreSQL → 右键目标数据库 → SQL 编辑器 → 新建 SQL 脚本 → 粘贴 → Alt+X 执行
--   2) 命令行：psql -U postgres -h localhost -d peteacher -f peteacher.sql
--
-- 注意：PostgreSQL 默认就是 UTF-8 编码，无需像 MySQL 那样声明 utf8mb4。
--       这里不包含 CREATE DATABASE（PostgreSQL 的建库不能在事务里执行），
--       请先在 DBeaver 里手动建好 peteacher 数据库，再连到它执行本脚本。

-- 1. 用户表（学生和老师都用这张表，用 role 区分）
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,                          -- SERIAL = 自增主键（等价 MySQL 的 AUTO_INCREMENT）
  account    VARCHAR(50)  NOT NULL UNIQUE,                -- 登录账号
  password   VARCHAR(255) NOT NULL,                       -- 存 bcrypt 哈希，绝不存明文
  name       VARCHAR(50)  NOT NULL,                       -- 姓名
  role       VARCHAR(20)  NOT NULL DEFAULT 'student'
             CHECK (role IN ('student','teacher')),       -- 用 CHECK 约束替代 MySQL 的 ENUM
  avatar     VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 教师表（只给 role=teacher 的用户建一条记录）
CREATE TABLE IF NOT EXISTS teachers (
  id         SERIAL PRIMARY KEY,
  user_id    INT          NOT NULL UNIQUE,                -- 关联 users.id，一个用户一条教师资料
  name       VARCHAR(50)  NOT NULL,
  subject    VARCHAR(50)  NOT NULL,                       -- 体育项目：篮球/羽毛球/游泳/体测辅导…
  intro      TEXT,
  avatar     VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teachers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. 可预约时段表
CREATE TABLE IF NOT EXISTS schedules (
  id         SERIAL PRIMARY KEY,
  teacher_id INT      NOT NULL,                           -- 关联 teachers.id
  date       DATE     NOT NULL,                           -- 预约日期，如 '2026-09-10'
  start_time TIME     NOT NULL,                           -- 开始时间，如 '14:00:00'
  end_time   TIME     NOT NULL,                           -- 结束时间，如 '15:00:00'
  capacity   INT      NOT NULL DEFAULT 1,                 -- 名额（同时能约几个人）
  price      NUMERIC(10,2) NOT NULL DEFAULT 0,            -- 价格（元），0 表示免费时段
  status     VARCHAR(20) NOT NULL DEFAULT 'open'
             CHECK (status IN ('open','closed')),         -- 时段状态
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedules_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- 4. 预约表
CREATE TABLE IF NOT EXISTS appointments (
  id          SERIAL PRIMARY KEY,
  student_id  INT  NOT NULL,                              -- 关联 users.id（预约的学生）
  schedule_id INT  NOT NULL,                              -- 关联 schedules.id
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','confirmed','cancelled')),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointments_student  FOREIGN KEY (student_id)  REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_appointments_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  UNIQUE (student_id, schedule_id)                        -- 同一学生不能重复约同一时段
);
