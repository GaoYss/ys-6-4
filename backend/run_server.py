import uvicorn
import sys

if __name__ == "__main__":
    print("Starting backend server on http://127.0.0.1:8000")
    sys.stdout.flush()
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        log_level="info"
    )
