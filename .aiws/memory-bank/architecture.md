# Architecture

目标：记录“模块关系与关键边界”，让新的会话可以快速对齐代码布局。

建议包含：
- 目录/模块分层（例如 server/web/app）
- 核心数据流（请求入口 → service → repo → DB）
- 关键约束（鉴权、request-id、幂等、事务）

