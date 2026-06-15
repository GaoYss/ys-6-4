import subprocess
import os
import signal
import time
import sys

print("Finding processes on port 8000...")
sys.stdout.flush()

result = subprocess.run(
    ["netstat", "-ano"],
    capture_output=True,
    text=True
)

pids_to_kill = set()
for line in result.stdout.split('\n'):
    if ':8000' in line and 'LISTENING' in line:
        parts = line.split()
        if parts:
            pid = parts[-1].strip()
            if pid.isdigit():
                pids_to_kill.add(int(pid))

print(f"Found PIDs: {pids_to_kill}")
sys.stdout.flush()

for pid in pids_to_kill:
    try:
        print(f"Killing PID {pid}...")
        sys.stdout.flush()
        os.kill(pid, signal.SIGTERM)
    except Exception as e:
        print(f"Error killing {pid}: {e}")
        sys.stdout.flush()

time.sleep(3)
print("Starting backend server...")
sys.stdout.flush()

import uvicorn
uvicorn.run(
    "app.main:app",
    host="127.0.0.1",
    port=8000,
    log_level="info"
)
