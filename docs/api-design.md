# 体育教师预约小程序 · 数据库与 API 设计文档

> 这是全栈项目最该先定下来的一份文档。前端、后端、建表三件事，都照着这份文档写，就不会各自跑偏。
> 技术栈：Node.js + Express + **PostgreSQL** + JWT（前端 uni-app/Vue3 对接这些接口）。

---

## 0. 全局约定（先读这段）

### 0.1 基础地址
- 后端开发地址：`http://localhost:3000`
- 所有接口路径以 `/api` 开头，例如 `http://localhost:3000/api/auth/login`

### 0.2 统一响应格式（每个接口都返回这个结构）

```json
{
  "code": 0,          // 0 表示成功；非 0 表示失败
  "message": "ok",    // 提示信息，失败时写原因
  "data": {}          // 业务数据，成功时有值，失败时为 null
}
```

错误码约定：

| code | 含义 |
|---|---|
| 0 | 成功 |
| 400 | 参数错误 / 缺少必填字段 |
| 401 | 未登录 / token 无效或过期 |
| 403 | 没有权限（如学生访问了老师接口） |
| 404 | 资源不存在 |
| 409 | 冲突（如重复预约、名额已满） |
| 500 | 服务器内部错误 |

### 0.3 认证方式（JWT）

- 注册 / 登录成功后，后端返回一个 `token`（JWT）。
- 之后所有**需要登录的接口**，请求头都要带：

```
Authorization: Bearer <token>
```

- token 里存两个信息：用户 `id` 和 `role`（`student` / `teacher`），后端中间件据此判断"你是谁、能干什么"。

### 0.4 角色权限

| 角色 | 能做的接口 |
|---|---|
| `student`（学生） | 看老师列表、看时段、创建预约、取消自己的预约、看"我的预约" |
| `teacher`（老师） | 上述学生能做的 + 发布/删除自己的时段、看自己的预约、确认/取消预约 |

> 接口路径里带 `teacher` 的（如 `POST /api/teacher/schedules`）都需要 `role = teacher`。

---

## 1. 数据库设计（MySQL）

### 1.1 表关系（文字版 ER）

```
users (用户表)
  ├── 1:1 ── teachers (教师表)     一个 teacher 账号对应一条教师资料
  └── 1:N ── appointments (预约表)  一个学生有多条预约

teachers (教师表)
  └── 1:N ── schedules (可预约时段)  一个老师发布多个时段

schedules (可预约时段)
  └── 1:N ── appointments (预约表)  一个时段可被多个学生预约（受 capacity 限制）
```

关系链一句话：**用户登录 → 老师拥有多个时段 → 学生对时段发起预约 → 老师确认/取消**。

### 1.2 完整 DDL（可直接复制到 PostgreSQL 执行）

> 先在 DBeaver 里手动建好 `peteacher` 数据库（PostgreSQL 的建库不能在事务里执行），再连到它执行下面的建表脚本。

```sql
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
```

### 1.3 字段设计要点（面试会问，先记下）

- `password` 存的是 **bcrypt 哈希**，不是明文。登录时用 `bcrypt.compare` 比对，绝不 `SELECT ... WHERE password = ?`。
- `appointments` 上的 `UNIQUE KEY (student_id, schedule_id)` 用数据库层防了"重复预约"，后端再做一次 `409` 兜底。
- `capacity`（名额）用于"名额已满"判断：`该时段已 confirmed 的预约数 >= capacity` 就拒绝新预约。
- 表都用了 `utf8mb4` + `InnoDB`，外键带 `ON DELETE CASCADE`（删老师连带删时段、删时段连带删预约）。

---

## 2. REST API 设计

> 请求体（body）统一用 JSON。`[登录]` 表示需带 token；`[teacher]` 表示需老师角色。

---

### 2.1 认证模块

#### ① 注册 `POST /api/auth/register`（公开）

请求体：
```json
{
  "account": "zhangsan",
  "password": "123456",
  "name": "张三",
  "role": "student"        // 可选，默认 student；老师传 "teacher"
}
```

成功响应（`code:0`）：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "eyJhbGciOi...",
    "user": { "id": 1, "account": "zhangsan", "name": "张三", "role": "student" }
  }
}
```
> 注意：注册老师时，除了建 `users` 记录，还要**同时在 `teachers` 表建一条记录**（name、subject、intro 这时可以先给默认值，之后补）。

#### ② 登录 `POST /api/auth/login`（公开）

请求体：
```json
{ "account": "zhangsan", "password": "123456" }
```

成功响应：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "eyJhbGciOi...",
    "user": { "id": 1, "account": "zhangsan", "name": "张三", "role": "student" }
  }
}
```

失败（账号或密码错误）：
```json
{ "code": 401, "message": "账号或密码错误", "data": null }
```

---

### 2.2 教师模块

#### ③ 老师列表 `GET /api/teachers`（公开）

查询参数（都可选）：
```
subject=篮球    按体育项目筛选
page=1          页码，默认 1
pageSize=10     每页条数，默认 10
```

成功响应：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "total": 23,
    "list": [
      {
        "id": 1,
        "name": "李老师",
        "subject": "篮球",
        "intro": "校队教练，10 年经验",
        "avatar": "https://...",
        "created_at": "2026-09-01 10:00:00"
      }
    ]
  }
}
```

#### ④ 老师详情（含可预约时段）`GET /api/teachers/:id`（公开）

路径参数：`:id` = 老师 id

成功响应：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "name": "李老师",
    "subject": "篮球",
    "intro": "校队教练，10 年经验",
    "avatar": "https://...",
    "schedules": [
      {
        "id": 101,
        "date": "2026-09-10",
        "start_time": "14:00:00",
        "end_time": "15:00:00",
        "capacity": 2,
        "booked": 1,          // 已预约人数（confirmed 的预约数）
        "status": "open"
      }
    ]
  }
}
```

---

### 2.3 时段模块

#### ⑤ 某老师的时段列表 `GET /api/teachers/:teacherId/schedules`（公开）

查询参数（可选）：`date=2026-09-10`（只查某一天）

成功响应：同上面 `schedules` 数组结构，用 `{ code:0, message:"ok", data: [ ... ] }` 返回。

#### ⑥ 老师发布时段 `POST /api/teacher/schedules` `[登录]` `[teacher]`

请求体：
```json
{
  "date": "2026-09-10",
  "start_time": "14:00:00",
  "end_time": "15:00:00",
  "capacity": 2
}
```

成功响应：
```json
{ "code": 0, "message": "ok", "data": { "id": 101, "date": "2026-09-10", "start_time": "14:00:00", "end_time": "15:00:00", "capacity": 2, "status": "open" } }
```

#### ⑦ 老师删除时段 `DELETE /api/teacher/schedules/:id` `[登录]` `[teacher]`

成功响应：
```json
{ "code": 0, "message": "删除成功", "data": null }
```
> 只能删自己的时段（后端校验 `schedules.teacher_id` 是否等于当前登录老师）。

---

### 2.4 预约模块

#### ⑧ 学生创建预约 `POST /api/appointments` `[登录]`（学生）

请求体：
```json
{ "schedule_id": 101 }
```

成功响应：
```json
{ "code": 0, "message": "预约成功", "data": { "id": 1001, "schedule_id": 101, "status": "pending", "created_at": "2026-09-01 10:30:00" } }
```

失败情况：
```json
{ "code": 409, "message": "名额已满", "data": null }
{ "code": 409, "message": "你已经预约过这个时段", "data": null }
{ "code": 404, "message": "时段不存在", "data": null }
```

#### ⑨ 我的预约 `GET /api/appointments/mine` `[登录]`（学生）

成功响应：
```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": 1001,
      "status": "pending",
      "created_at": "2026-09-01 10:30:00",
      "schedule": {
        "id": 101, "date": "2026-09-10", "start_time": "14:00:00", "end_time": "15:00:00"
      },
      "teacher": { "id": 1, "name": "李老师", "subject": "篮球" }
    }
  ]
}
```

#### ⑩ 取消预约 `DELETE /api/appointments/:id` `[登录]`（学生）

成功响应：
```json
{ "code": 0, "message": "已取消", "data": null }
```
> 只能取消自己的、且状态不是已取消的预约（软删除：把 `status` 改成 `cancelled` 即可，不用真删行）。

#### ⑪ 老师查看自己的预约 `GET /api/teacher/appointments` `[登录]` `[teacher]`

成功响应（按时段归组或平铺皆可，这里平铺）：
```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": 1001,
      "status": "pending",
      "student": { "id": 2, "name": "张三" },
      "schedule": { "id": 101, "date": "2026-09-10", "start_time": "14:00:00", "end_time": "15:00:00" },
      "created_at": "2026-09-01 10:30:00"
    }
  ]
}
```

#### ⑫ 老师确认/取消预约 `PATCH /api/teacher/appointments/:id` `[登录]` `[teacher]`

请求体：
```json
{ "status": "confirmed" }     // 或 "cancelled"
```

成功响应：
```json
{ "code": 0, "message": "ok", "data": { "id": 1001, "status": "confirmed" } }
```

---

## 3. 页面 ↔ 接口对应关系（前端照着调）

| 小程序页面 | 调用的接口 |
|---|---|
| 登录/注册页 | ② 登录 / ① 注册 |
| 首页（老师列表） | ③ 老师列表 |
| 老师详情页 | ④ 老师详情（自动带出时段） |
| 选时段 → 提交预约 | ⑧ 创建预约 |
| 我的预约页 | ⑨ 我的预约 |
| （取消按钮） | ⑩ 取消预约 |
| 老师端：发布时段页 | ⑥ 发布时段 |
| 老师端：我的预约页 | ⑪ 老师查看预约 |
| （确认/取消按钮） | ⑫ 老师确认/取消预约 |

核心闭环的接口顺序：
`登录(②)` → `老师列表(③)` → `老师详情(④)` → `创建预约(⑧)` → `我的预约(⑨)` → `老师确认(⑫)`

---

## 4. 后端项目建议目录结构（Express）

```
server/                          ← 后端代码根目录
├── package.json
├── .env                         ← 数据库密码、JWT 密钥等，别提交到 git
├── src/
│   ├── app.js                   ← Express 入口：挂中间件、挂路由
│   ├── config/
│   │   └── db.js                ← pg 连接池（PostgreSQL）
│   ├── middlewares/
│   │   └── auth.js              ← JWT 校验中间件（含角色判断）
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── teacher.routes.js
│   │   ├── schedule.routes.js
│   │   └── appointment.routes.js
│   ├── controllers/             ← 每个接口的处理逻辑
│   └── utils/
│       ├── response.js          ← 统一 { code, message, data } 封装
│       └── jwt.js               ← 签发/校验 token
└── peteacher.sql                ← 上面第 1.2 节的建表脚本
```

---

## 5. 需要装的 npm 依赖

```
express          Web 框架
pg               数据库驱动（node-postgres，连接 PostgreSQL）
jsonwebtoken     JWT 签发/校验
bcryptjs         密码加密（纯 JS，免编译）
cors             跨域（前端 H5 调后端要用）
dotenv           读 .env 环境变量
```

```bash
cd server
npm init -y
npm install express pg jsonwebtoken bcryptjs cors dotenv
npm install -D nodemon        # 开发时自动重启
```

---

> 这份文档定下来后，前端和后端就能**并行**开工了：前端先对着第 2 节的接口用假数据做页面，后端照着第 1 节建表、按第 4 节目录结构写接口。
