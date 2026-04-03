"""
SC2 Companion - Windows Desktop Session Agent via MCP
"""

import base64
import json
import sys
import time
import mss
import pywinauto
from mcp.server import Server
from mcp.types import Tool, TextContent, ImageContent
from pywinauto import Application, Desktop

server = Server("windows-desktop-agent")


@server.list_tools()
async def list_tools():
    return [
        Tool(name="list_windows", description="List all windows", inputSchema={"type": "object", "properties": {}}),
        Tool(name="get_active_window", description="Get active window", inputSchema={"type": "object", "properties": {}}),
        Tool(name="launch_app", description="Launch application", inputSchema={"type": "object", "properties": {"path": {"type": "string"}, "args": {"type": "string"}}, "required": ["path"]}),
        Tool(name="focus_window", description="Focus window", inputSchema={"type": "object", "properties": {"title": {"type": "string"}}, "required": ["title"]}),
        Tool(name="screenshot", description="Take screenshot", inputSchema={"type": "object", "properties": {"monitor": {"type": "integer"}}}),
        Tool(name="type_text", description="Type text", inputSchema={"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}),
        Tool(name="click", description="Click at coordinates", inputSchema={"type": "object", "properties": {"x": {"type": "integer"}, "y": {"type": "integer"}}}),
    ]


@server.call_tool()
async def call_tool(name, arguments):
    try:
        if name == "list_windows":
            return list_windows()
        elif name == "get_active_window":
            return get_active_window()
        elif name == "launch_app":
            return launch_app(**arguments)
        elif name == "focus_window":
            return focus_window(**arguments)
        elif name == "screenshot":
            return screenshot(**arguments)
        elif name == "type_text":
            return type_text(**arguments)
        elif name == "click":
            return click(**arguments)
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


def list_windows():
    desktop = Desktop(backend="win32")
    windows = []
    for w in desktop.windows():
        try:
            if w.visible and w.window_text():
                windows.append(f"[{w.handle}] {w.window_text()}")
        except:
            pass
    return [TextContent(type="text", text="\n".join(windows[:50]))]


def get_active_window():
    desktop = Desktop(backend="win32")
    active = desktop.active_window()
    if active:
        info = f"Title: {active.window_text()}\nHandle: {active.handle}\nClass: {active.class_name()}"
        return [TextContent(type="text", text=info)]
    return [TextContent(type="text", text="No active window")]


def launch_app(path, args=""):
    try:
        app = Application(backend="win32").start(f'"{path}" {args}')
        time.sleep(1)
        return [TextContent(type="text", text=f"Launched: {path}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Failed: {str(e)}")]


def focus_window(title):
    try:
        desktop = Desktop(backend="win32")
        for w in desktop.windows():
            if title.lower() in w.window_text().lower():
                w.set_focus()
                return [TextContent(type="text", text=f"Focused: {w.window_text()}")]
        return [TextContent(type="text", text=f"Window not found: {title}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


def screenshot(monitor=1):
    try:
        with mss.mss() as sct:
            monitor_info = sct.monitors[monitor]
            img = sct.grab(monitor_info)
            img_bytes = mss.tools.to_bytes(img)
            img_base64 = base64.b64encode(img_bytes).decode()
            return [ImageContent(type="image", data=img_base64, mimeType="image/png")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


def type_text(text):
    try:
        import pyautogui
        pyautogui.write(text, interval=0.05)
        return [TextContent(type="text", text=f"Typed: {text}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


def click(x, y):
    try:
        import pyautogui
        pyautogui.click(x, y)
        return [TextContent(type="text", text=f"Clicked: {x}, {y}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def main():
    print("Windows Desktop Agent starting...")
    print("MCP Server: windows-desktop-agent")
    from mcp.server.stdio import stdio_server
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
