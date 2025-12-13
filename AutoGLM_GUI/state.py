"""Shared runtime state for the AutoGLM-GUI API."""

from __future__ import annotations

import asyncio
import os
from typing import TYPE_CHECKING

from phone_agent.agent import AgentConfig
from phone_agent.model import ModelConfig

if TYPE_CHECKING:
    from AutoGLM_GUI.scrcpy_stream import ScrcpyStreamer
    from phone_agent import PhoneAgent

# Agent instances keyed by device_id
agents: dict[str, "PhoneAgent"] = {}
# Cached configs to rebuild agents on reset
agent_configs: dict[str, tuple[ModelConfig, AgentConfig]] = {}

# Scrcpy streaming per device
scrcpy_streamers: dict[str, "ScrcpyStreamer"] = {}
scrcpy_locks: dict[str, asyncio.Lock] = {}

# Defaults pulled from env (used when request omits config)
DEFAULT_BASE_URL: str = os.getenv("AUTOGLM_BASE_URL", "")
DEFAULT_MODEL_NAME: str = os.getenv("AUTOGLM_MODEL_NAME", "autoglm-phone-9b")
DEFAULT_API_KEY: str = os.getenv("AUTOGLM_API_KEY", "EMPTY")


def non_blocking_takeover(message: str) -> None:
    """Log takeover requests without blocking for console input."""
    print(f"[Takeover] {message}")
