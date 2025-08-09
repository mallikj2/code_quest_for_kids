from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import docker
import tempfile
import os
import uuid

app = FastAPI(title="Sandbox Service")

class RunReq(BaseModel):
    code: str

class RunRes(BaseModel):
    stdout: str
    stderr: str

# Pre-pulled minimal image recommended: python:3.11-alpine
# We enforce no net, cpu/mem limits, and short timeout.
BLOCKLIST = ["import os", "import sys", "import subprocess", "socket", "open(", "__import__", "eval(", "exec("]

@app.post("/run", response_model=RunRes)
async def run(req: RunReq):
    for bad in BLOCKLIST:
        if bad in req.code:
            return RunRes(stdout="", stderr="Blocked code detected")

    client = docker.from_env()

    tmpdir = tempfile.mkdtemp(prefix="cq_")
    code_path = os.path.join(tmpdir, "main.py")
    with open(code_path, "w") as f:
        f.write(req.code)

    # Command runs with resource limits and no network
    try:
        container = client.containers.run(
            image="python:3.11-alpine",
            command=["python", "/work/main.py"],
            volumes={tmpdir: {"bind": "/work", "mode": "ro"}},
            network_disabled=True,
            mem_limit="128m",
            nano_cpus=500_000_000, # 0.5 CPU
            detach=True,
            working_dir="/work",
        )
        result = container.wait(timeout=3)
        logs = container.logs(stdout=True, stderr=True)
        container.remove(force=True)
        stdout = logs.decode(errors="ignore")
        stderr = "" if result.get("StatusCode") == 0 else stdout
        if stderr:
            stdout = ""
        return RunRes(stdout=stdout.strip(), stderr=stderr.strip())
    except Exception as e:
        return RunRes(stdout="", stderr=str(e))
