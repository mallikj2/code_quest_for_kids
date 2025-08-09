from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import os
import re
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load env
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Mongo connection strictly via env
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')
if not MONGO_URL or not DB_NAME:
    raise RuntimeError('Missing MONGO_URL or DB_NAME env')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# FastAPI app and prefixed router
app = FastAPI(title="CodeQuest Kids API")
api = APIRouter(prefix="/api")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Data Models ----------
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Progress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    level_id: str
    passed: bool
    points_earned: int
    code: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Level(BaseModel):
    id: str
    title: str
    topic: str
    tutorial: str
    example_code: str
    challenge: str
    validator: Dict[str, Any]  # contains validation type and expected
    points: int

class CodeRunRequest(BaseModel):
    user_id: str
    level_id: str
    code: str

class CodeRunResponse(BaseModel):
    output: str
    error: Optional[str] = None
    passed: bool = False
    points_earned: int = 0

# ---------- Seed Levels (10) ----------
# Validators: simple types to keep logic in backend safe
LEVELS: List[Level] = [
    Level(
        id="1",
        title="Variables Explorer",
        topic="Variables",
        tutorial="In Python, variables store values. For example: name = 'Ava' and age = 9",
        example_code="name = 'Ava'\nage = 9\nprint(name, age)",
        challenge="Create a variable called pet and set it to 'cat'. Then print it.",
        validator={"type": "stdout_contains", "text": "cat"},
        points=10,
    ),
    Level(
        id="2",
        title="Math Magic",
        topic="Numbers",
        tutorial="Use + - * / to do math.",
        example_code="a = 5\nb = 3\nprint(a + b)",
        challenge="Print the result of 7 + 8",
        validator={"type": "equals_stdout", "text": "15"},
        points=10,
    ),
    Level(
        id="3",
        title="String Party",
        topic="Strings",
        tutorial="Strings are text inside quotes.",
        example_code="greeting = 'hi'\nprint(greeting.upper())",
        challenge="Print 'hello world' in all uppercase",
        validator={"type": "equals_stdout", "text": "HELLO WORLD"},
        points=10,
    ),
    Level(
        id="4",
        title="If Detective",
        topic="if/else",
        tutorial="Make choices with if/else.",
        example_code="x = 10\nif x &gt; 5:\n    print('big')\nelse:\n    print('small')",
        challenge="If number is greater than 3, print 'yay'",
        validator={"type": "stdout_contains", "text": "yay"},
        points=10,
    ),
    Level(
        id="5",
        title="Loop Land",
        topic="for loops",
        tutorial="Repeat with for loops.",
        example_code="for i in range(3):\n    print(i)",
        challenge="Print numbers 0,1,2 each on its own line",
        validator={"type": "equals_stdout_multi", "lines": ["0", "1", "2"]},
        points=10,
    ),
    Level(
        id="6",
        title="While Wheels",
        topic="while loops",
        tutorial="While repeats until a condition stops.",
        example_code="n = 0\nwhile n &lt; 3:\n    print(n)\n    n += 1",
        challenge="Use while to print 1,2,3",
        validator={"type": "equals_stdout_multi", "lines": ["1", "2", "3"]},
        points=10,
    ),
    Level(
        id="7",
        title="Function Factory",
        topic="functions",
        tutorial="Functions are reusable blocks using def.",
        example_code="def add(a, b):\n    return a + b\nprint(add(2,3))",
        challenge="Write a function add2 that adds 2 to a number and print add2(5)",
        validator={"type": "equals_stdout", "text": "7"},
        points=10,
    ),
    Level(
        id="8",
        title="List Lagoon",
        topic="lists",
        tutorial="Lists hold many items.",
        example_code="nums = [1,2,3]\nprint(len(nums))",
        challenge="Make a list [3,4,5] and print its length",
        validator={"type": "equals_stdout", "text": "3"},
        points=10,
    ),
    Level(
        id="9",
        title="Dict Den",
        topic="dicts",
        tutorial="Dictionaries map keys to values.",
        example_code="dog = {'name':'Bo','age':5}\nprint(dog['name'])",
        challenge="Create a dict with key 'color' 'blue' and print color",
        validator={"type": "equals_stdout", "text": "blue"},
        points=10,
    ),
    Level(
        id="10",
        title="Mini Project: Mascot Greeter",
        topic="project",
        tutorial="Combine variables, functions and prints.",
        example_code="def greet(name):\n    return 'Hello ' + name\nprint(greet('Coder'))",
        challenge="Write greet(name) and print Hello KidCoder",
        validator={"type": "equals_stdout", "text": "Hello KidCoder"},
        points=30,
    ),
]

# ---------- Utility: Basic safe code pre-check ----------
BLOCKED_PATTERNS = [
    r"\bimport\s+os\b",
    r"\bimport\s+sys\b",
    r"\bimport\s+subprocess\b",
    r"\bimport\s+socket\b",
    r"open\(",
    r"__import__",
    r"eval\(",
    r"exec\(",
]

SAFE_BUILTINS = {
    'abs': abs,
    'min': min,
    'max': max,
    'sum': sum,
    'len': len,
    'range': range,
    'print': print,
    'str': str,
    'int': int,
    'float': float,
    'bool': bool,
    'list': list,
    'dict': dict,
    'set': set,
    'tuple': tuple,
}

async def run_in_sandbox_fallback(code: str) -> Dict[str, str]:
    # In-process ultra-limited exec with timeout, no fs, no net, restricted builtins
    for pat in BLOCKED_PATTERNS:
        if re.search(pat, code):
            return {"stdout": "", "stderr": "Blocked code detected"}

    loop = asyncio.get_event_loop()
    stdout_capture: List[str] = []

    def safe_print(*args, **kwargs):
        msg = " ".join(str(a) for a in args)
        stdout_capture.append(msg)

    safe_globals = {
        "__builtins__": SAFE_BUILTINS | {"print": safe_print},
    }
    safe_locals: Dict[str, Any] = {}

    async def _run():
        try:
            exec(code, safe_globals, safe_locals)
            return "\n".join(stdout_capture), ""
        except Exception as e:
            return "\n".join(stdout_capture), str(e)

    try:
        return await asyncio.wait_for(_run(), timeout=3)
    except asyncio.TimeoutError:
        return "", "Timed out"

# ---------- Validators ----------
def validate_output(level: Level, stdout: str, stderr: str) -> Dict[str, Any]:
    if stderr:
        return {"passed": False, "points": 0}
    v = level.validator
    t = v.get("type")
    if t == "stdout_contains":
        return {"passed": v.get("text", "") in stdout, "points": level.points if v.get("text", "") in stdout else 0}
    if t == "equals_stdout":
        return {"passed": stdout.strip() == v.get("text", "").strip(), "points": level.points if stdout.strip() == v.get("text", "").strip() else 0}
    if t == "equals_stdout_multi":
        lines = [s.strip() for s in stdout.splitlines() if s.strip()]
        return {"passed": lines == v.get("lines", []), "points": level.points if lines == v.get("lines", []) else 0}
    return {"passed": False, "points": 0}

# ---------- Routes ----------
@api.get("/")
async def health():
    return {"message": "CodeQuest Kids API up"}

@api.get("/levels", response_model=List[Level])
async def get_levels():
    return LEVELS

class CreateUser(BaseModel):
    name: str

@api.post("/users", response_model=User)
async def create_user(payload: CreateUser):
    user = User(name=payload.name)
    await db.users.insert_one(user.model_dump())
    return user

@api.get("/users/{user_id}/progress")
async def get_user_progress(user_id: str):
    raw = await db.progress.find({"user_id": user_id}).to_list(1000)
    items = []
    for it in raw:
        it = dict(it)
        if "_id" in it:
            del it["_id"]
        items.append(it)
    # aggregate
    total_points = sum(it.get("points_earned", 0) for it in items)
    passed_levels = list({it.get("level_id") for it in items if it.get("passed")})
    return {"items": items, "total_points": total_points, "passed_levels": passed_levels}

@api.post("/execute_code", response_model=CodeRunResponse)
async def execute_code(req: CodeRunRequest):
    # choose sandbox microservice via env, else fallback
    use_fallback = os.environ.get('SANDBOX_URL') is None

    stdout = ""
    stderr = ""

    if use_fallback:
        stdout, stderr = await run_in_sandbox_fallback(req.code)
    else:
        # Call external sandbox service via HTTP
        import aiohttp
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(os.environ['SANDBOX_URL'] + '/run', json={"code": req.code}) as resp:
                    data = await resp.json()
                    stdout = data.get('stdout', '')
                    stderr = data.get('stderr', '')
        except Exception as e:
            stderr = f"Sandbox error: {e}"

    # validate
    level = next((l for l in LEVELS if l.id == req.level_id), None)
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    result = validate_output(level, stdout, stderr)
    passed = result["passed"]
    pts = result["points"] if passed else 0

    # persist progress
    prog = Progress(user_id=req.user_id, level_id=req.level_id, passed=passed, points_earned=pts, code=req.code)
    await db.progress.insert_one(prog.model_dump())

    return CodeRunResponse(output=stdout, error=stderr or None, passed=passed, points_earned=pts)

# Mount router
app.include_router(api)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()