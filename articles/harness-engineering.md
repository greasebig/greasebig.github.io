# Harness Engineering：驾驭 AI Agent 的工程艺术

> **核心公式：Agent = Model + Harness**
>
> *"Harness engineering is the idea that anytime you find an agent makes a mistake, you take the time to engineer a solution such that the agent will not make that mistake again in the future."*
> — Mitchell Hashimoto (HashiCorp 创始人、Terraform 共同开发者)，2026 年 2 月

---

## 一、什么是 Harness Engineering？

2026 年 AI 领域最重要的范式转移，不是更大的模型，而是 **Harness Engineering（驾驭工程）**—— 围绕 AI Agent 构建系统、工具、约束和反馈回路，让强大但不可预测的 AI 模型能够**可靠地**完成复杂任务。

**Harness 不是 Prompt Engineering。** Prompt Engineering 关心的是"对模型说什么"，而 Harness Engineering 关心的是"在模型周围构建什么"。前者脆弱且依赖特定模型，后者稳健且模型无关。

用一个比喻来理解：

> **LLM 是大脑，Harness 是身体。** 没有 Harness，模型只能"纸上谈兵"；有了 Harness，AI 才是真正的"实干家"。

---

## 二、Agent = Model + Harness

这个公式正在成为行业共识：

| 组件 | 职责 | 示例 |
|------|------|------|
| **Model** | 提供智能、推理、决策 | Claude、GPT-4、DeepSeek |
| **Harness** | 提供双手、眼睛、记忆、安全边界 | 工具、权限、记忆、验证循环 |

**关键洞察：一个优秀的 Harness 往往比一个更好的 Model 更重要。**

LangChain Terminal Bench 2.0 的对比实验证明了这一点：

- 无 Harness 优化：**52.8%** 准确率
- 仅添加 Harness 优化（同一模型）：**66.5%** 准确率
- **提升幅度：26%**

优化内容仅为：更好的上下文文件（AGENTS.md）、结构化输出约束、自我验证循环、工具优化。没有换模型，没有改 prompt。

---

## 三、Harness 的七大核心组件

### 1. Context Engineering（上下文工程）

给 Agent 一份代码库的"地图"，而不是"1000 页手册"。

**核心原则：上下文文件 ≤ 60 行。** 过长会导致 Agent 注意力涣散。

```markdown
# CLAUDE.md / AGENTS.md 示例
## Architecture
- src/app/ — 主应用逻辑
- src/lib/ — 共享工具库
- src/components/ — React 组件

## Rules
- API 调用统一走 src/lib/api.ts
- 不在组件中直接引用 node_modules
- 提交信息用英文
```

### 2. Architectural Constraints（架构约束）

**不靠 hope，靠 enforce。** 用 lint 规则、测试、类型系统强制约束 Agent 的行为，而不是期望它"自觉"遵守。

- ESLint `no-restricted-imports` 防止错误的依赖引用
- 分层架构验证，禁止跨层调用
- 结构化测试在模式违反时报错

> *"Constrain the solution space — don't expand it. Fewer valid options means fewer wrong answers."*

### 3. Tools & MCP Servers（工具与协议）

Agent 的手和脚。赋予模型与外部世界交互的能力。

- **文件操作**：Read / Write / Edit / Glob / Grep
- **Shell 执行**：Bash 命令（带权限控制）
- **Web 交互**：WebFetch / WebSearch
- **MCP 协议**：连接任意外部服务和 API
- **Agent 协作**：子 Agent 派发与协调

### 4. Sub-Agents & Context Firewalls（子 Agent 与上下文防火墙）

**上下文是消耗品。** 长会话中模型性能会随上下文积累而下降（context rot）。

解决方案：
- 复杂任务拆分为独立子任务
- 每个子任务在独立会话中运行
- **只传递结构化结果**，不传递原始对话

Anthropic 的双 Agent 架构：
1. **Initializer Agent** — 制定计划，生成功能列表
2. **Coding Agent** — 逐个执行每个功能

### 5. Hooks & Back-Pressure（钩子与背压）

自动化反馈回路，在错误累积之前捕获它们。

- **Pre-commit hooks**：类型检查、lint、格式化
- **Test runners**：每次修改后自动运行测试
- **Build verification**：快速失败

> *"Success should be silent; failure should be loud."* — 只把错误推给 Agent 上下文，不要用冗余的成功日志淹没它。

### 6. Self-Verification Loops（自我验证循环）

强迫 Agent 在标记任务完成之前验证自己的工作：

- 运行测试套件
- 确认构建通过
- 验证输出符合规格
- UI 工作：截图并做 diff 对比

> *"This is the difference between an agent that 'thinks it's done' and one that actually is."*

### 7. Progress Documentation（进度记录）

对于超过 ~30 分钟的任务，维护结构化进度记录，确保**替换会话可以无缝恢复**。

- 维护进度文件追踪已完成步骤
- 频繁 commit
- 使用结构化任务列表，而非自由格式笔记

---

## 四、WorkBuddy 能用 Harness 吗？

**能，而且 WorkBuddy 本身就是一套 Harness。**

WorkBuddy（CodeBuddy）实现了 Harness Engineering 的多个核心组件：

| Harness 组件 | WorkBuddy 对应实现 |
|---|---|
| Context Engineering | SOUL.md / IDENTITY.md / USER.md / MEMORY.md 工作记忆系统 |
| Tools | 完整的工具集（文件 I/O、Shell、Web、Agent、Task） |
| Hooks | 自动化 triggers、定时任务 |
| Permissions | 安全策略（content_policy、personal_files_safety、working_modes） |
| Sub-Agents | Agent 工具（子 Agent 派发、TeamCreate） |
| Self-Verification | Agent Loop 中的迭代验证 |
| Progress | TaskCreate/Update/List 任务管理系统 |
| Memory | 跨会话持久记忆（MEMORY.md + daily logs） |

**作为 WorkBuddy 用户，你可以直接利用的 Harness 能力：**

1. **编写 AGENTS.md / SOUL.md**：定义 Agent 的行为规范、项目架构、编码规则
2. **使用 Skills 系统**：按需加载领域知识（如 `law-enforcement-chat-analysis`）
3. **利用 Task 管理**：复杂任务拆分、进度追踪
4. **构建 MEMORY.md**：积累跨会话知识，让 Agent "越用越懂你"
5. **自定义 Automations**：定时任务和事件驱动的自动化

**进阶建议**：WorkBuddy 用户可以通过优质的 SOUL.md + MEMORY.md 配置，在不写一行代码的情况下构建强大的个人 Harness。

---

## 五、自建 OpenClaw 如何用 Harness？

OpenClaw 作为开源 AI Coding Agent，天然适合作为 Harness Engineering 的实践平台。以下是实操路线：

### 方案一：集成 OpenHarness

[OpenHarness](https://github.com/HKUDS/OpenHarness) 是港大开源的一个轻量级 Agent Harness 框架（12.2K+ Stars），用 1.1 万行 Python 代码实现了 Claude Code 核心架构的 80%。

```bash
# 1. 安装 OpenHarness
pip install openharness-ai

# 2. 配置模型提供商
oh setup
# Provider: anthropic → Claude 系列
# Provider: openai → GPT-4
# Provider: deepseek → DeepSeek
# Provider: ollama → 本地开源模型

# 3. 创建项目的 CLAUDE.md
cat > CLAUDE.md << 'EOF'
## Project: OpenClaw Custom Agent
## Architecture
- src/core/ — Agent loop & tool execution
- src/tools/ — Custom tools
- src/memory/ — Persistent memory

## Rules
- All API calls go through src/lib/gateway.ts
- Commit messages in English
- Tests required for new tools
EOF

# 4. 启动 Harness
oh
```

### 方案二：自建 Harness 核心组件

```python
# 最小可用的 Harness 实现
class AgentHarness:
    def __init__(self, model, tools, memory_path="MEMORY.md"):
        self.model = model
        self.tools = tools          # 工具注册表
        self.memory = self.load_memory(memory_path)
        self.constraints = []       # 架构约束规则
        self.hooks = {"pre": [], "post": []}  # 生命周期钩子
    
    def run(self, task):
        # 1. 注入上下文
        context = self.build_context(task)
        
        # 2. Agent Loop
        while not done:
            response = self.model.stream(messages, self.tools)
            
            if response.has_tool_calls:
                # 权限检查 → 钩子 → 执行 → 结果
                for tool_call in response.tool_calls:
                    if self.check_permission(tool_call):
                        self.run_hooks("pre", tool_call)
                        result = self.execute(tool_call)
                        self.run_hooks("post", tool_call, result)
                        messages.append(result)
            else:
                done = True
        
        # 3. 自我验证
        self.verify(result)
        
        # 4. 更新记忆
        self.save_memory()
        
        return result
```

### 关键实践清单

| 实践 | 怎么做 |
|------|--------|
| 上下文 | 维护 ≤60 行的 CLAUDE.md，放在项目根目录 |
| 记忆 | 自动维护 MEMORY.md，记录偏好、已知问题、架构决策 |
| 工具 | 优先使用标准 CLI（git、npm），代理天然熟悉 |
| 权限 | 白名单路径 + 禁止危险命令（rm -rf、git push --force） |
| 验证 | 每次代码修改后自动运行 lint + test |
| 拆分 | 复杂任务用子 Agent，每个子 Agent 在独立会话中 |
| 进度 | 结构化任务列表 + 频繁 commit |

---

## 六、Harness vs. Prompt Engineering

| | Prompt Engineering | Harness Engineering |
|---|---|---|
| **焦点** | 对模型说什么 | 在模型周围构建什么 |
| **持久性** | 脆弱，模型相关 | 稳健，模型无关 |
| **复利效应** | 不随时间改进 | 每次迭代都更强 |
| **范围** | 单次交互 | 整个工作流 |
| **技能类型** | 写作 | 系统工程 |

---

## 七、结论

2026 年的 AI 竞争已从"谁的模型更强"转向"谁的 Harness 更好"。Mitchell Hashimoto 的洞察改变了一切：

> *"The model is the engine; the harness is the car. No one wins a race with just an engine."*

对于 WorkBuddy 用户：你今天就在使用一套 Harness —— 通过优化 SOUL.md、MEMORY.md 和 Skills，可以持续提升它的能力。

对于 OpenClaw 自建用户：OpenHarness 提供了一个经过验证的起点。核心原则只有一个：**每次 Agent 犯错，花时间设计一个工程方案，让它不再犯同样的错误。**

这就是 Harness Engineering —— 让 AI 从"能用"走向"可靠"的工程艺术。

---

*参考来源：Mitchell Hashimoto (2026.2), Y Build Harness Guide, LangChain Terminal Bench 2.0, OpenHarness (HKUDS), OpenAI Codex Team Report, Anthropic Dual-Agent Architecture, Stripe Minions System*
