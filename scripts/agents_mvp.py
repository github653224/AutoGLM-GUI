#!/usr/bin/env python3
"""
OpenAI Agents SDK MVP - 分层智能体架构

架构:
    用户 -> 规划 Agent (glm-4.7) -> 工具调用 -> Phone Agent (autoglm-phone-9b) -> 手机

使用方法:
    python scripts/agents_mvp.py
"""

import asyncio
import json
import os
import sys

from agents import (
    Agent,
    Runner,
    SQLiteSession,
    function_tool,
    set_tracing_export_api_key,
)
from agents.models.openai_chatcompletions import OpenAIChatCompletionsModel
from openai import AsyncOpenAI

from AutoGLM_GUI.config_manager import config_manager
from AutoGLM_GUI.logger import logger

# ==================== 配置 ====================
set_tracing_export_api_key(os.environ["OPENAI_API_KEY"])

PLANNER_MODEL = "glm-4.7"  # 规划层使用的模型（使用支持工具调用的模型）

PLANNER_INSTRUCTIONS = """## 核心目标
你是一个负责操控手机的高级智能中枢。你的任务是将用户的意图转化为**视觉模型（Vision Model）**可以执行的原子操作。

## ⚠️ 极其重要的限制：视觉模型的能力边界 (Must Read)
你的下级（Vision Model）是一个**纯粹的执行者和观察者**。
1. **无“记忆/笔记”功能**：它没有 `Note` 功能，无法为你保存数据。
2. **无“系统级”权限**：它不能复制源代码，不能直接提取文本，不能读取剪贴板。
3. **唯一的输出**：它只能通过**对话**告诉你它看到了什么，或者去**点击/滑动**屏幕。

## 交互策略 (Interaction Strategy)

### 1. 如果你需要“操作手机” (To Act)
下达明确的 UI 动作指令。
- ✅ "点击'设置'图标。"
- ✅ "向下滑动屏幕。"

### 2. 如果你需要“获取信息” (To Read/Extract)
你必须通过**提问**的方式，让视觉模型在对话中把信息“念”给你听。
- ❌ **错误**: "把验证码保存下来。" (它做不到)
- ❌ **错误**: "使用 Note 功能记录价格。" (它没有这个功能)
- ✅ **正确**: 调用 `chat` 询问："请看屏幕，告诉我现在的订单总金额是多少？"
  - *结果*: 视觉模型会回复 "25.5元"。你需要自己处理这个文本信息。

### 3. 如果用户要求“复制/粘贴”
必须通过模拟手指操作来实现，不能直接操作剪贴板。
- ✅ **正确**: "长按这段文字，等待弹出菜单，然后点击'复制'按钮。"

## 任务拆解原则 (Decomposition Rules)

1. **原子化**: 每次只给一个动作。
2. **可视化**: 指令必须基于屏幕上**看得见**的元素。不要说“点击确认”，如果屏幕上显示的按钮叫“OK”，请说“点击'OK'按钮”。
3. **Fail Fast**: 如果视觉模型回复 `ELEMENT_NOT_FOUND`，不要死循环。询问它：“那现在屏幕上有什么？”或者尝试滑动寻找。

## 核心工作流 (The Loop)
1. **Observe (看)**: 调用 `chat` 询问当前状态。
   - "现在屏幕上显示什么？" / "刚才的点击生效了吗？"
2. **Think (想)**:
   - 用户的目标是什么？
   - 我需要让视觉模型**做什么动作**，还是**回答什么问题**？
3. **Act (做)**:
   - **Case A (动作)**: 发送指令 `点击[坐标]...`
   - **Case B (询问)**: 发送问题 `请读取...`

## 内部思维链示例 (Inner Monologue)

**场景 1: 用户让你“把这篇笔记的标题发给我”**
> **Current State**: 笔记详情页。
> **Goal**: 获取标题文本。
> **Constraint**: 视觉模型无法直接提取变量，我必须问它。
> **Strategy**: 问视觉模型标题是什么，它回答后，我再反馈给用户。
> **Next Action**: 提问。
**Output**: `chat(id, "请读取并告诉我屏幕上这篇笔记的标题文字内容是什么？")`

**场景 2: 用户让你“复制链接”**
> **Current State**: 详情页。
> **Goal**: 把链接复制到系统剪贴板。
> **Constraint**: 不能直接 Get Link。必须找“分享”或“复制”按钮。
> **Strategy**: 先点右上角菜单，再找复制链接。
> **Next Action**: 点击菜单。
**Output**: `chat(id, "点击屏幕右上角的'...'（三个点）菜单按钮。")`

## 工具集 (Tools)
1. `list_devices()`
2. `chat(device_id, message)`: 
   - 发送操作指令（如“点击红色按钮”）。
   - 发送查询问题（如“那个验证码是多少？”）。

"""


# ==================== 工具定义 ====================


@function_tool
def list_devices() -> str:
    """
    获取所有连接的 ADB 设备列表。

    返回设备信息包括:
    - id: 设备标识符，用于 chat 工具调用
    - model: 设备型号
    - status: 连接状态
    - connection_type: 连接类型 (usb/wifi/remote)

    Returns:
        JSON 格式的设备列表
    """
    from AutoGLM_GUI.api.devices import _build_device_response_with_agent
    from AutoGLM_GUI.device_manager import DeviceManager
    from AutoGLM_GUI.phone_agent_manager import PhoneAgentManager

    logger.info("[Agents MVP] list_devices tool called")

    device_manager = DeviceManager.get_instance()
    agent_manager = PhoneAgentManager.get_instance()

    # 如果轮询未启动，执行同步刷新
    if not device_manager._poll_thread or not device_manager._poll_thread.is_alive():
        logger.warning("Polling not started, performing sync refresh")
        device_manager.force_refresh()

    managed_devices = device_manager.get_devices()

    # 构建设备响应
    devices_with_agents = [
        _build_device_response_with_agent(d, agent_manager) for d in managed_devices
    ]

    return json.dumps(devices_with_agents, ensure_ascii=False, indent=2)


@function_tool
def chat(device_id: str, message: str) -> str:
    """
    向指定设备的 Phone Agent 发送子任务指令。

    Phone Agent 是一个视觉模型，能够看到手机屏幕并执行操作。
    每次调用会执行一个原子化的子任务（最多 5 步操作）。

    Args:
        device_id: 设备标识符，从 list_devices 获取
        message: 子任务指令，例如 "打开微信"、"点击搜索按钮"

    Returns:
        JSON 格式的执行结果，包含:
        - result: 执行结果描述
        - steps: 执行的步数
        - success: 是否成功
    """
    from AutoGLM_GUI.exceptions import DeviceBusyError
    from AutoGLM_GUI.phone_agent_manager import PhoneAgentManager
    from AutoGLM_GUI.prompts import MCP_SYSTEM_PROMPT_ZH

    MCP_MAX_STEPS = 5

    logger.info(
        f"[Agents MVP] chat tool called: device_id={device_id}, message={message}"
    )

    manager = PhoneAgentManager.get_instance()

    try:
        # use_agent 现在会自动初始化 agent（auto_initialize=True）
        with manager.use_agent(device_id, timeout=None) as agent:
            # 临时覆盖配置
            original_max_steps = agent.agent_config.max_steps
            original_system_prompt = agent.agent_config.system_prompt

            agent.agent_config.max_steps = MCP_MAX_STEPS
            agent.agent_config.system_prompt = MCP_SYSTEM_PROMPT_ZH

            try:
                # 重置 agent 确保干净状态
                agent.reset()

                result = agent.run(message)
                steps = agent.step_count

                # 检查是否达到步数限制
                if steps >= MCP_MAX_STEPS and result == "Max steps reached":
                    return json.dumps(
                        {
                            "result": f"⚠️ 已达到最大步数限制（{MCP_MAX_STEPS}步）。视觉模型可能遇到了困难，任务未完成。\n\n执行历史:\n{agent.get_context()}\n\n建议: 请重新规划任务或将其拆分为更小的子任务。",
                            "steps": MCP_MAX_STEPS,
                            "success": False,
                        },
                        ensure_ascii=False,
                    )

                return json.dumps(
                    {
                        "result": result,
                        "steps": steps,
                        "success": True,
                    },
                    ensure_ascii=False,
                )

            finally:
                # 恢复原始配置
                agent.agent_config.max_steps = original_max_steps
                agent.agent_config.system_prompt = original_system_prompt

    except DeviceBusyError:
        return json.dumps(
            {
                "result": f"设备 {device_id} 正忙，请稍后再试。",
                "steps": 0,
                "success": False,
            },
            ensure_ascii=False,
        )
    except Exception as e:
        logger.error(f"[Agents MVP] chat tool error: {e}")
        return json.dumps(
            {
                "result": str(e),
                "steps": 0,
                "success": False,
            },
            ensure_ascii=False,
        )


# ==================== 初始化 ====================


def setup_openai_client() -> AsyncOpenAI:
    """设置 OpenAI 客户端，使用 AutoGLM 的配置"""
    # 加载配置
    config_manager.load_file_config()
    effective_config = config_manager.get_effective_config()

    if not effective_config.base_url:
        print("❌ 错误: 未配置 base_url")
        print("请先通过以下方式配置:")
        print("  1. 设置环境变量 AUTOGLM_BASE_URL")
        print("  2. 或在 ~/.config/autoglm/config.json 中配置")
        sys.exit(1)

    print(f"📡 API Base URL: {effective_config.base_url}")
    print(f"🤖 Planner Model: {PLANNER_MODEL}")

    # 创建自定义 OpenAI 客户端
    client = AsyncOpenAI(
        base_url=effective_config.base_url,
        api_key=effective_config.api_key,
    )

    return client


def create_planner_agent(client: AsyncOpenAI) -> Agent:
    """创建规划 Agent，使用 Chat Completions API（而非 Responses API）"""
    # 使用 OpenAIChatCompletionsModel 因为智谱 API 不支持 Responses API
    model = OpenAIChatCompletionsModel(
        model=PLANNER_MODEL,
        openai_client=client,
    )

    return Agent(
        name="Planner",
        instructions=PLANNER_INSTRUCTIONS,
        model=model,
        tools=[list_devices, chat],
    )


# ==================== 主循环 ====================


async def main():
    """主函数 - 命令行交互循环"""
    print("=" * 60)
    print("🚀 OpenAI Agents SDK MVP - 分层智能体架构")
    print("=" * 60)

    # 初始化
    client = setup_openai_client()
    agent = create_planner_agent(client)

    # 创建内存 session 用于对话持久化（进程结束后丢失）
    session = SQLiteSession("planner_conversation")

    print("\n✅ 初始化完成！")
    print("💡 输入任务指令，例如: '帮我打开微信'")
    print("💡 输入 'quit' 或 'exit' 退出\n")

    while True:
        try:
            # 获取用户输入
            user_input = input("👤 你: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ["quit", "exit", "q"]:
                print("👋 再见！")
                break

            print("\n🤔 正在思考...\n")

            # 运行 Agent，传入 session 以保持对话上下文
            result = await Runner.run(agent, user_input, session=session, max_turns=50)

            # 输出结果
            print(f"🤖 助手: {result.final_output}\n")

        except KeyboardInterrupt:
            print("\n👋 再见！")
            break
        except Exception as e:
            print(f"\n❌ 错误: {e}\n")
            logger.exception("Agent execution error")


if __name__ == "__main__":
    asyncio.run(main())
