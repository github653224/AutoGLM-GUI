"""Device discovery routes."""

from fastapi import APIRouter

from AutoGLM_GUI.schemas import DeviceListResponse
from AutoGLM_GUI.state import agents

router = APIRouter()


@router.get("/api/devices", response_model=DeviceListResponse)
def list_devices() -> DeviceListResponse:
    """列出所有 ADB 设备。"""
    from phone_agent.adb import list_devices as adb_list

    adb_devices = adb_list()

    return DeviceListResponse(
        devices=[
            {
                "id": d.device_id,
                "model": d.model or "Unknown",
                "status": d.status,
                "connection_type": d.connection_type.value,
                "is_initialized": d.device_id in agents,
            }
            for d in adb_devices
        ]
    )
