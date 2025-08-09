# CodeQuest For Kids

Here’s first working MVP of CodeQuest Kids – live and tested.

<Plan> - Implement minimal end-to-end that proves the “code → run → validate → points” loop quickly. - Backend (FastAPI + Mongo via env): levels, user create, progress, and safe code execution with 3s timeout, whitelisted builtins, blocked dangerous modules. All routes prefixed with /api. - Frontend (React + Tailwind + shadcn/ui): fun, clean UI with levels list, learn/try/output tabs, “Run & Check,” points and badges. Use env REACT_APP_BACKEND_URL for API. - Include sandbox microservice (Docker SDK) and docker-compose for local isolation execution, but use in-process safe fallback here for instant experience. - Automated smoke tests (backend + UI) to confirm the loop. </Plan>
What’s done now

End-to-end app is running. You can open the frontend URL and pass level 1. Your output and points save to Mongo.
Automated smoke tests passed (backend + UI). I also captured screenshots of the page and a successful run.
Architecture (high-level)

Frontend (React):
Reads REACT_APP_BACKEND_URL from frontend/.env; never hardcodes.
Calls backend via /api routes only.
Backend (FastAPI):
Binds to 0.0.0.0:8001 (handled by supervisor).
Uses MONGO_URL and DB_NAME from backend/.env. UUIDs only.
Endpoints:
GET /api/ → health
GET /api/levels → 10 levels
POST /api/users → create user
GET /api/users/{id}/progress → items, total_points, passed_levels
POST /api/execute_code → safe run + validation + store progress
Safe in-process code execution fallback:
Whitelisted builtins only, blocked dangerous imports, 3s timeout, no FS or network.
Sandbox microservice (for local/dcx use):
FastAPI + Docker SDK; runs code in python:3.11-alpine container.
No network, CPU/mem limits, 3s timeout.
Backend can call this via SANDBOX_URL if provided; otherwise fallback executor is used.
Updated/added files

Backend
/app/backend/server.py: Full API, models, execution, validation.
Frontend
/app/frontend/src/App.js: Complete UI (levels, tabs, run, toasts, progress).
/app/frontend/src/App.css: Modern playful styles and fonts.
Sandbox service (for local dev)
/app/sandbox/service.py
/app/sandbox/Dockerfile
Compose for local full stack
/app/docker-compose.yml
Folder structure (relevant)

/app/backend
server.py (FastAPI app, /api routes)
requirements.txt
.env (MONGO_URL, DB_NAME, CORS_ORIGINS)
/app/frontend
.env (REACT_APP_BACKEND_URL)
package.json
src/App.js, App.css, index.js, index.css
src/components/ui (shadcn components)
/app/sandbox
service.py, Dockerfile
/app/docker-compose.yml
Security highlights

Fallback executor:
Only whitelisted Python builtins available (print, range, len, etc.).
Proactively blocks os, sys, subprocess, socket, eval, exec, import, and open(.
3-second asyncio timeout.
Sandbox microservice (local):
python:3.11-alpine container, network-disabled, mem_limit 128MB, 0.5 CPU, 3s wait.
All backend endpoints validated by Pydantic schemas (FastAPI generates JSON Schema).
Data isolation: UUID IDs, Mongo via env.
CORS controlled via env; HTTPS is enforced by your environment; for local, see instructions below.
Levels implemented (10)

1) Variables, 2) Math, 3) Strings, 4) If/Else, 5) For-loops, 6) While, 7) Functions, 8) Lists, 9) Dicts, 10) Mini-Projec
Each has:
Short tutorial
Example
Challenge
Validation (stdout rules)
Points
Automated smoke tests: Passed

Backend
GET /api/ → 200, “CodeQuest Kids API up”
GET /api/levels → length 10, first is “Variables Explorer”
POST /api/users → returns UUID
POST /api/execute_code (level 1 cat test) → passed=true, points=10, output “cat”
GET /api/users/{id}/progress → total_points ≥ 10, passed_levels includes “1”
Frontend
Header shows “CodeQuest Kids”
Levels render and clickable
“Try it” tab works, textarea accepts code
“Run & Check” executes and “Output” tab shows “cat”
Success toast and points badge update
How to run locally (docker-compose, optional)

Purpose: use real containerized sandbox + Mongo locally.
Steps:
Make sure Docker is available and you can mount the Docker socket.
In /app/backend/.env, set:
MONGO_URL=mongodb://mongo:27017
DB_NAME=codequest
CORS_ORIGINS=*
Run:
docker compose up --build
The backend will use SANDBOX_URL=http://sandbox:8080 (set in compose) and call sandbox service for execution.
HTTPS locally:
For local HTTPS, add a reverse proxy (Caddy/Traefik) with a self-signed cert in front of the frontend and backend; I can add a Caddyfile if you want.
How to add a new level

Edit /app/backend/server.py, append to LEVELS list:
id: string
title: “Your Title”
topic: “your-topic”
tutorial: brief explanation
example_code: a short snippet
challenge: instructions
validator: one of
{type: "stdout_contains", text: "expected substring"}
{type: "equals_stdout", text: "expected exact"}
{type: "equals_stdout_multi", lines: ["line1", "line2"]}
points: integer points
Restart backend: sudo supervisorctl restart backend
The UI automatically lists the new level.
Notes about environment rules

Frontend always uses process.env.REACT_APP_BACKEND_URL, and prefixes all routes with /api (no hardcoding).
Backend uses os.environ.get('MONGO_URL') and DB_NAME (no hardcoding).
Supervisor controls ports; we didn’t change your .env files.
What you can try now

Open our frontend URL.
Level 1: paste: pet = 'cat' print(pet)
Click Run & Check, then Output tab to see results.
Watch points and “Done” badges update.

Roadmap suggestions (pick your next enhancement)

Monaco Editor for a real coding feel (lightweight theme, children-friendly font size).
Confetti and celebratory animation on pass, collectible badges per topic.
Hints system with progressive clue reveals.
Parental/teacher dashboard to view class progress.
Local HTTPS via Caddy in docker-compose.
Full container sandbox in this environment: set SANDBOX_URL in backend env and I’ll add aiohttp to requirements.
Do you want me to:

Add Monaco Editor and a polished code panel now?
Add confetti + badge cabinet and a progress map?
Wire backend to real Docker sandbox (and add aiohttp in requirements) for parity with local compose?


