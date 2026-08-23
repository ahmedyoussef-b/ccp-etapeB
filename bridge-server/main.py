"""
NexaFlow Physical Bridge Server
Bridge physique entre le navigateur et le matériel réel (ESP32, PLC, caméras IP, etc.)
Usage: python bridge-server.py
"""

import json
import time
import threading
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="NexaFlow Bridge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ActuatorCommand(BaseModel):
    id: str
    state: bool | int
    type: str = "unknown"

class SensorReading(BaseModel):
    id: str
    value: float
    unit: str = ""

DEVICE_STATE: dict[str, dict] = {}
HISTORY: list[dict] = []
BRIDGE_START = time.time()

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "uptime": round(time.time() - BRIDGE_START, 2),
        "devices": len(DEVICE_STATE),
        "commands": len(HISTORY),
    }

@app.post("/api/actuator")
async def set_actuator(cmd: ActuatorCommand):
    key = f"{cmd.type}:{cmd.id}"
    DEVICE_STATE[key] = {
        "type": cmd.type,
        "state": cmd.state,
        "lastCommand": f"set {cmd.id} = {cmd.state}",
        "lastCommandAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    HISTORY.append({
        "type": "actuator",
        "id": cmd.id,
        "state": cmd.state,
        "timestamp": time.time(),
    })
    return {"success": True, "message": f"Commande envoyée à {cmd.id}", "device": {"id": cmd.id, "type": cmd.type, "state": cmd.state}}

@app.get("/api/sensor")
async def get_sensor(id: str):
    sensor = DEVICE_STATE.get(f"sensor:{id}")
    if sensor:
        return {"id": id, "value": sensor["state"], "unit": sensor.get("unit", ""), "source": "bridge"}
    return {"id": id, "value": None, "source": "not_found"}

@app.post("/api/sensor")
async def set_sensor(reading: SensorReading):
    key = f"sensor:{reading.id}"
    DEVICE_STATE[key] = {
        "type": "sensor",
        "state": reading.value,
        "unit": reading.unit,
        "lastCommand": f"read {reading.id}",
        "lastCommandAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    return {"success": True, "id": reading.id, "value": reading.value, "unit": reading.unit}

@app.get("/api/devices")
async def list_devices():
    return {"devices": list(DEVICE_STATE.keys())}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "time": time.time()}))
            elif message.get("type") == "sensor":
                key = f"sensor:{message['id']}"
                DEVICE_STATE[key] = {
                    "type": "sensor",
                    "state": message["value"],
                    "unit": message.get("unit", ""),
                    "lastCommand": f"ws read {message['id']}",
                    "lastCommandAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
                await websocket.send_text(json.dumps({"type": "sensor", "id": message["id"], "value": message["value"], "unit": message.get("unit", "")}))
            elif message.get("type") == "actuator":
                key = f"{message.get('deviceType', 'unknown')}:{message['id']}"
                DEVICE_STATE[key] = {
                    "type": message.get("deviceType", "unknown"),
                    "state": message["state"],
                    "lastCommand": f"ws set {message['id']} = {message['state']}",
                    "lastCommandAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
                HISTORY.append({
                    "type": "actuator",
                    "id": message["id"],
                    "state": message["state"],
                    "timestamp": time.time(),
                })
                await websocket.send_text(json.dumps({"type": "actuator", "id": message["id"], "state": message["state"], "success": True}))
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
