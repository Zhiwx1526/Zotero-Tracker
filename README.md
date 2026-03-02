# 基于大模型的文献追踪与推送系统

## 项目简介

这是一个基于Zotero的插件，使用大模型技术实现文献的智能追踪与推送。插件能够从用户的Zotero文献库中构建兴趣画像，自动追踪相关网站的新文献，并将相关度高的文献推送给用户。

## 核心功能

1. **用户兴趣画像构建**：从Zotero读取用户文献库，使用预训练模型将文献转换为语义向量，构建用户兴趣画像
2. **多网站文献追踪**：支持追踪arXiv和PubMed的新文献
3. **引用追踪**：追踪用户已有文献的新增引用
4. **智能筛选**：使用向量相似度计算+TF-IDF/TextRank算法筛选相关文献
5. **文献概述生成**：调用大模型API生成文献概述
6. **个性化推送**：相关度达到阈值的文献推送给用户
7. **快捷键支持**：默认空格键触发，可配置
8. **选中文献向量生成**：支持在Zotero中选择文献并生成向量
9. **向量存储与管理**：使用SQLite数据库存储和管理文献向量
10. **用户画像管理**：支持构建、更新（暂时未使用增量更新，后续再改）和查看用户画像
11. **Python文献获取**：使用Python脚本获取文献，提供更稳定的文献获取能力

## 技术架构

- **前端**：XUL + Fluent（Zotero原生UI）
- **后端**：Zotero Plugin API
- **存储**：SQLite（向量和配置）
- **AI模型**：支持OpenAI API和本地伪向量
- **向量模型**：sentence-transformers/all-MiniLM-L6-v2（计划）

## 安装方法

### 1. 安装Zotero插件

1. 下载最新的插件XPI文件
2. 在Zotero中，点击「工具」→「插件」
3. 点击右上角的齿轮图标，选择「从文件安装插件...」
4. 选择下载的XPI文件，点击「打开」
5. 重启Zotero以完成安装

### 2. 安装Python服务器

1. 确保已安装Python 3.8+
2. 运行启动脚本：
   - Windows: 双击 `start-server.bat`
   - macOS/Linux: 运行 `python python/literature_server.py`
3. 启动脚本会自动安装所需依赖并启动服务器
4. 服务器将在 `http://localhost:5000` 上运行

### 3. 验证服务器

打开浏览器访问 `http://localhost:5000/health`，如果返回 `{"status":"ok"}` 则表示服务器运行正常

## 使用方法

### 0. 启动Python服务器

在使用插件前，请确保Python服务器已启动：

1. 运行 `start-server.bat`（Windows）或 `python python/literature_server.py`（macOS/Linux）
2. 服务器启动后会显示「Running on http://localhost:5000」
3. 保持服务器运行状态

### 1. 配置设置

1. 点击「编辑」→「首选项」→「Literature Tracker」
2. 在设置面板中：
   - 输入API Key（支持OpenAI和Claude）
   - 选择要追踪的网站（arXiv和PubMed）
   - 调整相关度阈值滑块
   - 设置快捷键（默认为空格键）

### 2. 手动触发文献追踪

- 按下配置的快捷键（默认为空格键）
- 或点击插件菜单中的「追踪文献」选项

### 3. 生成选中文献的向量

- 在Zotero中选择一个或多个文献
- 点击「工具」→「Literature Tracker」→「Generate Vectors for Selected Items」
- 插件会为选中文献生成向量并存储

### 4. 构建用户画像

- 点击「工具」→「Literature Tracker」→「Build User Profile」
- 插件会分析用户文献库中的所有文献，生成兴趣中心向量、核心主题和关键词
- 构建完成后会显示通知

### 5. 更新用户画像

- 当用户添加新文献后，点击「工具」→「Literature Tracker」→「Update User Profile」
- 插件会重新分析所有文献，更新用户画像
- 更新完成后会显示通知

### 6. 查看推送的文献

- 插件会在发现相关文献时弹出通知
- 点击通知查看文献详情和概述

## 项目结构

```
├── addon/             # 插件核心代码
│   ├── content/       # 前端内容
│   ├── locale/        # 本地化文件
│   ├── bootstrap.js   # 插件引导
│   ├── manifest.json  # 插件配置
│   └── prefs.js       # 设置项
├── src/               # TypeScript源代码
│   ├── modules/       # 功能模块
│   ├── utils/         # 工具函数
│   ├── addon.ts       # 插件主类
│   ├── hooks.ts       # 生命周期钩子
│   └── index.ts       # 入口文件
├── typings/           # TypeScript类型定义
├── package.json       # 项目配置
└── webpack.config.js  # Webpack配置
```

## 模块说明

### 1. literatureReader.ts
- 从Zotero读取用户文献库
- 支持获取所有文献、按集合获取、搜索文献等功能
- 新增：支持获取选中文献的功能

### 2. vectorStore.ts
- 使用SQLite存储文献向量
- 实现向量相似度计算和查询

### 3. vectorGenerator.ts
- 实现向量生成功能
- 支持使用OpenAI API生成向量
- 支持生成本地伪向量作为备选方案

### 4. literatureTrackingService.ts
- 实现文献追踪服务
- 支持从arXiv获取最新文献
- 管理追踪配置和偏好设置

### 5. preferenceScript.ts
- 处理设置面板的逻辑
- 管理用户配置

### 6. userProfile.ts
- 实现用户画像构建功能
- 支持兴趣中心向量计算
- 支持核心兴趣主题识别
- 支持关键词提取
- 提供用户画像的构建、更新和获取方法

## 配置项说明

| 配置项 | 说明 | 默认值 |
|-------|------|--------|
| openaiKey | OpenAI API密钥 | 空 |
| claudeKey | Claude API密钥 | 空 |
| trackArxiv | 是否追踪arXiv | true |
| trackPubmed | 是否追踪PubMed | true |
| relevanceThreshold | 相关度阈值 | 0.7 |
| shortcutKey | 快捷键 | 空格 |
| categories | 追踪的arXiv分类 | ['cs.AI', 'cs.LG'] |
| keywords | 追踪的关键词 | [] |
| authors | 追踪的作者 | [] |
| maxResults | 最大结果数 | 50 |

## 常见问题

### 1. 插件无法初始化
- 检查Zotero版本是否兼容（需要Zotero 6.0+）
- 检查API Key是否正确
- 查看Zotero日志获取详细错误信息

### 2. 文献追踪不工作
- 检查网络连接
- 检查网站选择是否正确
- 检查相关度阈值是否设置过高

### 3. 大模型API调用失败
- 检查API Key是否有效
- 检查网络连接是否正常
- 尝试切换到其他模型提供商

## 开发指南

### 环境要求

- Node.js 18+
- npm 9+
- Zotero 6.0+

### 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start

# 构建插件
npm run build

# 运行测试
npm test

# 代码检查
npm run lint:check
```

### 调试方法

1. 在Zotero中，设置环境变量 `DEBUG=literature-tracker`
2. 打开「帮助」→「调试输出」→「查看输出」
3. 查看插件的日志信息

## TODO列表

### 第一阶段（已完成）
- [x] 使用Zotero Plugin Template初始化项目结构
- [x] 创建设置面板UI，包含API Key输入、网站选择、阈值滑块、快捷键设置
- [x] 实现Zotero文献读取模块（支持获取选中文献）
- [x] 设计向量存储方案（SQLite）
- [x] 实现插件主入口和初始化逻辑
- [x] 实现文献向量生成功能（支持OpenAI API和本地伪向量）
- [x] 实现网站爬虫（arXiv）
- [x] 实现向量相似度计算和相关文献筛选
- [x] 集成大模型API（OpenAI）
- [x] 实现用户画像构建功能
- [x] 创建项目文档和TODO列表

### 第二阶段
- [ ] 实现引用追踪功能
- [ ] 实现文献推送功能
- [ ] 支持PubMed网站爬虫
- [ ] 集成Claude API

### 第三阶段
- [ ] 添加更多可追踪的文献网站
- [ ] 实现本地模型支持
- [ ] 添加文献推荐可视化界面
- [ ] 优化性能和用户体验
- [ ] 编写详细的用户文档

## 贡献指南

欢迎提交Issue和Pull Request！

### 提交规范

- 提交消息使用英文
- 遵循Conventional Commits规范
- 代码风格使用项目的ESLint和Prettier配置

## 许可证

本项目采用AGPL-3.0许可证。详见[LICENSE](LICENSE)文件。

## 联系方式

- 项目地址：https://github.com/yourusername/literature-tracker
- 问题反馈：https://github.com/yourusername/literature-tracker/issues

---

**注意**：本插件需要联网使用，并且会调用第三方API（如OpenAI），请确保遵守相关服务的使用条款和隐私政策。
