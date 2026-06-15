import os
import signal
import subprocess
import sys
import time

def kill_processes_on_port(port):
    result = subprocess.run(
        ["netstat", "-ano"],
        capture_output=True,
        text=True
    )
    pids = set()
    for line in result.stdout.split('\n'):
        if f':{port}' in line and 'LISTENING' in line:
            parts = line.split()
            pid = parts[-1]
            pids.add(pid)
    
    for pid in pids:
        try:
            print(f"Killing process {pid}...")
            os.kill(int(pid), signal.SIGTERM)
        except Exception as e:
            print(f"Failed to kill {pid}: {e}")
    
    time.sleep(2)
    return pids

if __name__ == "__main__":
    port = 8000
    killed = kill_processes_on_port(port)
    print(f"Killed processes: {killed}")
    print(f"Starting server on port {port}...")
    sys.stdout.flush()
    
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info"
    )
