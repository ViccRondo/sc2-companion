"""
SC2 Companion - Supervisor Service
"""

import os
import sys
import time
import subprocess
import psutil

CONFIG = {
    "agent_script": "C:\\openclaw-agent\\session_agent.py",
    "python_path": "C:\\Program Files\\Python312\\python.exe",
    "check_interval": 30,
    "max_restarts": 10,
    "log_file": "C:\\openclaw-agent\\supervisor.log",
}

LOG_FILE = CONFIG["log_file"]


def log(msg):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    try:
        Path(LOG_FILE).parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except:
        pass
    print(line)


def check_agent_running():
    for proc in psutil.process_iter(["name", "cmdline"]):
        try:
            cmdline = proc.info.get("cmdline") or []
            if any("session_agent.py" in str(c) for c in cmdline):
                return True
        except:
            pass
    return False


def start_agent():
    try:
        log("Starting session agent...")
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = subprocess.SW_HIDE
        process = subprocess.Popen(
            [CONFIG["python_path"], CONFIG["agent_script"]],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            startupinfo=startupinfo,
            cwd=os.path.dirname(CONFIG["agent_script"])
        log(f"Agent started with PID: {process.pid}")
        return True
    except Exception as e:
        log(f"Failed to start agent: {e}")
        return False


def main():
    log("=" * 50)
    log("SC2 Companion Supervisor Starting...")
    restart_count = 0
    while True:
        try:
            if check_agent_running():
                log("Agent is running")
            else:
                log("Agent not running, starting...")
                if start_agent():
                    restart_count += 1
                    log(f"Restart count: {restart_count}/{CONFIG['max_restarts']}")
                    if restart_count >= CONFIG["max_restarts"]:
                        log("Max restarts reached, exiting")
                        break
            time.sleep(CONFIG["check_interval"])
        except KeyboardInterrupt:
            log("Supervisor stopped by user")
            break
        except Exception as e:
            log(f"Error: {e}")
            time.sleep(CONFIG["check_interval"])
    log("Supervisor exited")


if __name__ == "__main__":
    main()
