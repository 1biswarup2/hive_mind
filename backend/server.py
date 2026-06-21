"""HiveMind — Internal Organizational Problem Marketplace & Contribution Economy.

Multi-tenant FastAPI + MongoDB backend. Single-file for MVP clarity.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import uuid
import bcrypt
import jwt
import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import (
    FastAPI,
    APIRouter,
    HTTPException,
    Request,
    Response,
    Depends,
    UploadFile,
    File,
    Query,
    Header,
)
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ----- Config -----
JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 24  # 1 day
REFRESH_TTL_DAYS = 7
APP_NAME = os.environ.get("APP_NAME", "hivemind")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("hivemind")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="HiveMind API")
api = APIRouter(prefix="/api")

# ----- Default categories & rewards -----
DEFAULT_CATEGORIES = [
    "Business Introduction", "Networking", "Hiring", "Research",
    "Market Intelligence", "Government Relations", "Vendor Discovery",
    "Customer Acquisition", "Product Feedback", "Domain Expertise",
    "Legal Guidance", "Fundraising", "Partnership", "Mentorship", "General Help",
]

DEFAULT_REWARDS = [
    {"name": "Amazon Gift Card ₹500", "credits": 100, "image": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80", "stock": 100},
    {"name": "Amazon Gift Card ₹2,500", "credits": 500, "image": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80", "stock": 50},
    {"name": "Cash Bonus ₹5,000", "credits": 1000, "image": "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=400&q=80", "stock": 25},
    {"name": "Extra Day Off", "credits": 800, "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80", "stock": 999},
    {"name": "Learning Budget ₹10,000", "credits": 2000, "image": "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80", "stock": 10},
    {"name": "Conference Pass", "credits": 5000, "image": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&q=80", "stock": 5},
    {"name": "Company Hoodie", "credits": 400, "image": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&q=80", "stock": 50},
    {"name": "Premium Headphones", "credits": 3000, "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80", "stock": 8},
]

DEFAULT_DEPARTMENTS = ["Engineering", "Sales", "Marketing", "Product", "HR", "Finance", "Operations"]

BADGE_DEFS = [
    {"key": "problem_solver", "name": "Problem Solver", "icon": "Trophy",
     "tiers": {"bronze": 1, "silver": 5, "gold": 15, "platinum": 30, "diamond": 60}},
    {"key": "connector", "name": "Connector", "icon": "Network",
     "tiers": {"bronze": 1, "silver": 3, "gold": 10, "platinum": 25, "diamond": 50}},
    {"key": "top_contributor", "name": "Top Contributor", "icon": "Star",
     "tiers": {"bronze": 100, "silver": 500, "gold": 1500, "platinum": 5000, "diamond": 15000}},
]


# ----- Utils -----
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, org_id: str) -> str:
    payload = {
        "sub": user_id, "org": org_id, "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, org_id: str) -> str:
    payload = {
        "sub": user_id, "org": org_id, "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS),
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=ACCESS_TTL_MIN * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=REFRESH_TTL_DAYS * 86400, path="/")


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def public_user(u: dict) -> dict:
    return {
        "id": u["id"], "name": u["name"], "email": u["email"],
        "role": u.get("role", "employee"),
        "org_id": u["org_id"],
        "department": u.get("department"),
        "designation": u.get("designation"),
        "expertise_tags": u.get("expertise_tags", []),
        "skills": u.get("skills", []),
        "avatar_url": u.get("avatar_url"),
        "reputation_score": u.get("reputation_score", 0),
        "credits_earned": u.get("credits_earned", 0),
        "credits_redeemed": u.get("credits_redeemed", 0),
        "credits_balance": u.get("credits_earned", 0) - u.get("credits_redeemed", 0),
        "badges": u.get("badges", []),
        "created_at": u.get("created_at"),
    }


# ----- Auth dependency -----
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


def require_role(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return _dep


# ----- Pydantic models -----
class OrgRegister(BaseModel):
    org_name: str
    org_domain: str
    admin_name: str
    admin_email: EmailStr
    admin_password: str = Field(min_length=6)


class UserRegister(BaseModel):
    org_domain: str
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    department: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    expertise_tags: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    avatar_url: Optional[str] = None


class RoleUpdate(BaseModel):
    role: Literal["admin", "manager", "reviewer", "employee"]


class RequestCreate(BaseModel):
    title: str
    description: str
    category: str
    tags: List[str] = []
    difficulty: Literal["easy", "medium", "hard", "expert"] = "medium"
    bounty_credits: int = Field(ge=0, default=100)
    due_date: Optional[str] = None
    visibility: Literal["org", "department"] = "org"
    department: Optional[str] = None


class RequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    difficulty: Optional[str] = None
    bounty_credits: Optional[int] = None
    due_date: Optional[str] = None
    status: Optional[str] = None


class SolutionCreate(BaseModel):
    submission_text: str
    links: List[str] = []
    file_ids: List[str] = []


class ReviewAction(BaseModel):
    action: Literal["approve", "reject", "request_changes"]
    feedback: Optional[str] = None


class CategoryCreate(BaseModel):
    name: str


class RewardCreate(BaseModel):
    name: str
    credits: int
    image: Optional[str] = None
    stock: int = 100


class RewardRedeem(BaseModel):
    reward_id: str


# ----- Storage -----
_storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY missing — storage disabled")
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init",
                          json={"emergent_key": EMERGENT_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(503, "Storage unavailable")
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key, "Content-Type": content_type},
                     data=data, timeout=120)
    r.raise_for_status()
    return r.json()


def get_object(path: str) -> tuple:
    key = init_storage()
    if not key:
        raise HTTPException(503, "Storage unavailable")
    r = requests.get(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# ----- Reputation & badges -----
def compute_reputation(credits_earned: int, solved: int, total: int, avg_rating: float = 5.0) -> int:
    success = (solved / total * 100) if total else 0
    return int(credits_earned * 0.5 + solved * 25 + success * 2 + avg_rating * 10)


async def recompute_user_stats(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    solved = await db.requests_col.count_documents({
        "claimed_by": user_id, "status": "completed"
    })
    submitted = await db.solutions.count_documents({"contributor_id": user_id})
    rep = compute_reputation(user.get("credits_earned", 0), solved, max(submitted, 1))

    # award badges
    badges = list(user.get("badges", []))
    badge_keys = {(b["key"], b["tier"]) for b in badges}
    for bd in BADGE_DEFS:
        if bd["key"] == "problem_solver":
            metric = solved
        elif bd["key"] == "connector":
            metric = solved  # simple proxy
        else:
            metric = user.get("credits_earned", 0)
        for tier, threshold in bd["tiers"].items():
            if metric >= threshold and (bd["key"], tier) not in badge_keys:
                badges.append({"key": bd["key"], "name": bd["name"], "icon": bd["icon"],
                               "tier": tier, "earned_at": now_iso()})
                badge_keys.add((bd["key"], tier))
    await db.users.update_one({"id": user_id},
                              {"$set": {"reputation_score": rep, "badges": badges}})


async def award_credits(org_id: str, to_user_id: str, amount: int, request_id: str, reason: str):
    await db.users.update_one({"id": to_user_id},
                              {"$inc": {"credits_earned": amount}})
    await db.transactions.insert_one({
        "id": new_id(), "org_id": org_id, "source_user": None,
        "destination_user": to_user_id, "credits": amount,
        "transaction_type": "earn", "reason": reason,
        "request_id": request_id, "timestamp": now_iso(),
    })


async def log_audit(org_id: str, actor_id: str, action: str, target: str = "", meta: dict = None):
    await db.audit_logs.insert_one({
        "id": new_id(), "org_id": org_id, "actor_id": actor_id,
        "action": action, "target": target, "meta": meta or {},
        "timestamp": now_iso(),
    })


async def notify(org_id: str, user_id: str, message: str, link: str = ""):
    await db.notifications.insert_one({
        "id": new_id(), "org_id": org_id, "user_id": user_id,
        "message": message, "link": link, "read": False,
        "timestamp": now_iso(),
    })


# ===== AUTH =====
@api.post("/auth/register-org")
async def register_org(payload: OrgRegister, response: Response):
    domain = payload.org_domain.lower().strip()
    if await db.organizations.find_one({"domain": domain}):
        raise HTTPException(400, "Organization domain already exists")
    email = payload.admin_email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")

    org_id = new_id()
    org = {
        "id": org_id, "name": payload.org_name, "domain": domain,
        "logo": None, "credit_value_inr": 5, "categories": DEFAULT_CATEGORIES.copy(),
        "departments": DEFAULT_DEPARTMENTS.copy(),
        "created_at": now_iso(),
    }
    await db.organizations.insert_one(org)

    # seed default rewards for this org
    for r in DEFAULT_REWARDS:
        await db.rewards.insert_one({**r, "id": new_id(), "org_id": org_id, "active": True})

    user_id = new_id()
    user = {
        "id": user_id, "org_id": org_id, "email": email,
        "name": payload.admin_name, "password_hash": hash_password(payload.admin_password),
        "role": "admin", "department": "Operations", "designation": "Admin",
        "expertise_tags": [], "skills": [], "avatar_url": None,
        "reputation_score": 0, "credits_earned": 0, "credits_redeemed": 0,
        "badges": [], "created_at": now_iso(),
    }
    await db.users.insert_one(user)

    access = create_access_token(user_id, org_id)
    refresh = create_refresh_token(user_id, org_id)
    set_auth_cookies(response, access, refresh)
    await log_audit(org_id, user_id, "org_created", org_id, {"name": payload.org_name})
    return {"user": public_user(user), "org": {k: v for k, v in org.items() if k != "_id"}}


@api.post("/auth/register")
async def register_user(payload: UserRegister, response: Response):
    domain = payload.org_domain.lower().strip()
    org = await db.organizations.find_one({"domain": domain}, {"_id": 0})
    if not org:
        raise HTTPException(404, "Organization not found")
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")

    user_id = new_id()
    user = {
        "id": user_id, "org_id": org["id"], "email": email,
        "name": payload.name, "password_hash": hash_password(payload.password),
        "role": "employee", "department": payload.department or "Engineering",
        "designation": None, "expertise_tags": [], "skills": [],
        "avatar_url": None, "reputation_score": 0, "credits_earned": 0,
        "credits_redeemed": 0, "badges": [], "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    access = create_access_token(user_id, org["id"])
    refresh = create_refresh_token(user_id, org["id"])
    set_auth_cookies(response, access, refresh)
    await log_audit(org["id"], user_id, "user_registered", user_id)
    return {"user": public_user(user), "org": org}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    access = create_access_token(user["id"], user["org_id"])
    refresh = create_refresh_token(user["id"], user["org_id"])
    set_auth_cookies(response, access, refresh)
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    return {"user": public_user(user), "org": org}


@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    return {"user": public_user(user), "org": org}


@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    tok = request.cookies.get("refresh_token")
    if not tok:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(tok, jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token")
        access = create_access_token(payload["sub"], payload["org"])
        response.set_cookie("access_token", access, httponly=True, secure=True,
                            samesite="none", max_age=ACCESS_TTL_MIN * 60, path="/")
        return {"ok": True}
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")


# ===== ORG =====
@api.get("/org")
async def get_org(user: dict = Depends(get_current_user)):
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    return org


@api.patch("/org")
async def update_org(payload: dict, user: dict = Depends(require_role("admin"))):
    allowed = {"name", "logo", "credit_value_inr", "categories", "departments"}
    upd = {k: v for k, v in payload.items() if k in allowed}
    if upd:
        await db.organizations.update_one({"id": user["org_id"]}, {"$set": upd})
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    await log_audit(user["org_id"], user["id"], "org_updated", user["org_id"], upd)
    return org


@api.get("/org/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    return org.get("categories", DEFAULT_CATEGORIES)


@api.post("/org/categories")
async def add_category(payload: CategoryCreate, user: dict = Depends(require_role("admin"))):
    await db.organizations.update_one(
        {"id": user["org_id"]}, {"$addToSet": {"categories": payload.name}}
    )
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    return org.get("categories", [])


@api.get("/org/departments")
async def list_departments(user: dict = Depends(get_current_user)):
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    return org.get("departments", DEFAULT_DEPARTMENTS)


# ===== USERS =====
@api.get("/users")
async def list_users(user: dict = Depends(get_current_user),
                     q: Optional[str] = None, department: Optional[str] = None):
    flt = {"org_id": user["org_id"]}
    if department:
        flt["department"] = department
    if q:
        flt["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                      {"email": {"$regex": q, "$options": "i"}},
                      {"skills": {"$regex": q, "$options": "i"}}]
    items = await db.users.find(flt, {"_id": 0, "password_hash": 0}).to_list(500)
    return [public_user(u) for u in items]


@api.get("/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": user_id, "org_id": user["org_id"]},
                                {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "User not found")
    return public_user(u)


@api.patch("/users/me")
async def update_me(payload: UserUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(u)


@api.patch("/users/{user_id}/role")
async def change_role(user_id: str, payload: RoleUpdate,
                      user: dict = Depends(require_role("admin"))):
    target = await db.users.find_one({"id": user_id, "org_id": user["org_id"]})
    if not target:
        raise HTTPException(404, "User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"role": payload.role}})
    await log_audit(user["org_id"], user["id"], "role_changed", user_id, {"role": payload.role})
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    return public_user(u)


# ===== REQUESTS =====
@api.get("/requests")
async def list_requests(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    category: Optional[str] = None,
    department: Optional[str] = None,
    q: Optional[str] = None,
    creator_id: Optional[str] = None,
    claimed_by: Optional[str] = None,
):
    flt = {"org_id": user["org_id"]}
    if status:
        flt["status"] = status
    if category:
        flt["category"] = category
    if department:
        flt["department"] = department
    if creator_id:
        flt["creator_id"] = creator_id
    if claimed_by:
        flt["claimed_by"] = claimed_by
    if q:
        flt["$or"] = [{"title": {"$regex": q, "$options": "i"}},
                      {"description": {"$regex": q, "$options": "i"}},
                      {"tags": {"$regex": q, "$options": "i"}}]
    items = await db.requests_col.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    # decorate with creator/claimer summary
    ids = list({r["creator_id"] for r in items} | {r["claimed_by"] for r in items if r.get("claimed_by")})
    users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    umap = {u["id"]: {"id": u["id"], "name": u["name"], "avatar_url": u.get("avatar_url"),
                     "department": u.get("department")} for u in users}
    for r in items:
        r["creator"] = umap.get(r["creator_id"])
        r["claimer"] = umap.get(r.get("claimed_by")) if r.get("claimed_by") else None
    return items


@api.post("/requests")
async def create_request(payload: RequestCreate, user: dict = Depends(get_current_user)):
    rid = new_id()
    doc = {
        "id": rid, "org_id": user["org_id"], "creator_id": user["id"],
        "title": payload.title, "description": payload.description,
        "category": payload.category, "tags": payload.tags,
        "difficulty": payload.difficulty, "bounty_credits": payload.bounty_credits,
        "due_date": payload.due_date, "visibility": payload.visibility,
        "department": payload.department or user.get("department"),
        "status": "open", "claimed_by": None, "claimed_at": None,
        "completed_at": None, "view_count": 0,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.requests_col.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user["org_id"], user["id"], "request_created", rid)
    return doc


@api.get("/requests/{rid}")
async def get_request(rid: str, user: dict = Depends(get_current_user)):
    r = await db.requests_col.find_one({"id": rid, "org_id": user["org_id"]}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Request not found")
    await db.requests_col.update_one({"id": rid}, {"$inc": {"view_count": 1}})
    creator = await db.users.find_one({"id": r["creator_id"]}, {"_id": 0, "password_hash": 0})
    r["creator"] = public_user(creator) if creator else None
    if r.get("claimed_by"):
        claimer = await db.users.find_one({"id": r["claimed_by"]}, {"_id": 0, "password_hash": 0})
        r["claimer"] = public_user(claimer) if claimer else None
    solutions = await db.solutions.find({"request_id": rid}, {"_id": 0}).sort("submitted_at", -1).to_list(100)
    for s in solutions:
        contrib = await db.users.find_one({"id": s["contributor_id"]}, {"_id": 0, "password_hash": 0})
        s["contributor"] = public_user(contrib) if contrib else None
    r["solutions"] = solutions
    return r


@api.patch("/requests/{rid}")
async def update_request(rid: str, payload: RequestUpdate, user: dict = Depends(get_current_user)):
    r = await db.requests_col.find_one({"id": rid, "org_id": user["org_id"]})
    if not r:
        raise HTTPException(404, "Request not found")
    if r["creator_id"] != user["id"] and user["role"] not in ("admin", "manager"):
        raise HTTPException(403, "Not allowed")
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    upd["updated_at"] = now_iso()
    await db.requests_col.update_one({"id": rid}, {"$set": upd})
    await log_audit(user["org_id"], user["id"], "request_updated", rid, upd)
    r2 = await db.requests_col.find_one({"id": rid}, {"_id": 0})
    return r2


@api.post("/requests/{rid}/claim")
async def claim_request(rid: str, user: dict = Depends(get_current_user)):
    r = await db.requests_col.find_one({"id": rid, "org_id": user["org_id"]})
    if not r:
        raise HTTPException(404, "Request not found")
    if r["status"] not in ("open",):
        raise HTTPException(400, f"Cannot claim a request in '{r['status']}' status")
    if r["creator_id"] == user["id"]:
        raise HTTPException(400, "You cannot claim your own request")
    await db.requests_col.update_one({"id": rid}, {"$set": {
        "status": "claimed", "claimed_by": user["id"],
        "claimed_at": now_iso(), "updated_at": now_iso(),
    }})
    await notify(user["org_id"], r["creator_id"],
                 f"{user['name']} claimed your request: {r['title']}", f"/requests/{rid}")
    await log_audit(user["org_id"], user["id"], "request_claimed", rid)
    return await db.requests_col.find_one({"id": rid}, {"_id": 0})


@api.post("/requests/{rid}/unclaim")
async def unclaim_request(rid: str, user: dict = Depends(get_current_user)):
    r = await db.requests_col.find_one({"id": rid, "org_id": user["org_id"]})
    if not r:
        raise HTTPException(404, "Not found")
    if r.get("claimed_by") != user["id"] and user["role"] not in ("admin", "manager"):
        raise HTTPException(403, "Not allowed")
    await db.requests_col.update_one({"id": rid}, {"$set": {
        "status": "open", "claimed_by": None, "claimed_at": None, "updated_at": now_iso(),
    }})
    return await db.requests_col.find_one({"id": rid}, {"_id": 0})


@api.post("/requests/{rid}/status")
async def set_status(rid: str, payload: dict, user: dict = Depends(get_current_user)):
    status = payload.get("status")
    allowed = ["open", "claimed", "in_progress", "submitted", "under_review", "completed", "rejected"]
    if status not in allowed:
        raise HTTPException(400, "Invalid status")
    r = await db.requests_col.find_one({"id": rid, "org_id": user["org_id"]})
    if not r:
        raise HTTPException(404, "Not found")
    if user["id"] not in (r["creator_id"], r.get("claimed_by")) and user["role"] not in ("admin", "manager"):
        raise HTTPException(403, "Not allowed")
    await db.requests_col.update_one({"id": rid}, {"$set": {"status": status, "updated_at": now_iso()}})
    return await db.requests_col.find_one({"id": rid}, {"_id": 0})


# ===== SOLUTIONS =====
@api.post("/requests/{rid}/solutions")
async def submit_solution(rid: str, payload: SolutionCreate, user: dict = Depends(get_current_user)):
    r = await db.requests_col.find_one({"id": rid, "org_id": user["org_id"]})
    if not r:
        raise HTTPException(404, "Request not found")
    if r["status"] in ("completed", "rejected"):
        raise HTTPException(400, "Request is closed")
    sid = new_id()
    doc = {
        "id": sid, "request_id": rid, "org_id": user["org_id"],
        "contributor_id": user["id"], "submission_text": payload.submission_text,
        "links": payload.links, "file_ids": payload.file_ids,
        "status": "pending", "feedback": None,
        "submitted_at": now_iso(),
    }
    await db.solutions.insert_one(doc)
    doc.pop("_id", None)
    await db.requests_col.update_one({"id": rid}, {"$set": {
        "status": "submitted", "updated_at": now_iso()
    }})
    await notify(user["org_id"], r["creator_id"],
                 f"{user['name']} submitted a solution to: {r['title']}", f"/requests/{rid}")
    await log_audit(user["org_id"], user["id"], "solution_submitted", sid, {"request": rid})
    return doc


@api.post("/solutions/{sid}/review")
async def review_solution(sid: str, payload: ReviewAction, user: dict = Depends(get_current_user)):
    s = await db.solutions.find_one({"id": sid, "org_id": user["org_id"]})
    if not s:
        raise HTTPException(404, "Solution not found")
    r = await db.requests_col.find_one({"id": s["request_id"], "org_id": user["org_id"]})
    if not r:
        raise HTTPException(404, "Request not found")
    if user["id"] != r["creator_id"] and user["role"] not in ("admin", "reviewer", "manager"):
        raise HTTPException(403, "Only the creator or reviewers can review")

    new_status = {"approve": "approved", "reject": "rejected", "request_changes": "changes_requested"}[payload.action]
    await db.solutions.update_one({"id": sid}, {"$set": {
        "status": new_status, "feedback": payload.feedback,
        "reviewed_by": user["id"], "reviewed_at": now_iso(),
    }})

    if payload.action == "approve":
        await db.requests_col.update_one({"id": r["id"]}, {"$set": {
            "status": "completed", "completed_at": now_iso(), "updated_at": now_iso(),
        }})
        await award_credits(user["org_id"], s["contributor_id"], r["bounty_credits"],
                            r["id"], f"Solved: {r['title']}")
        await recompute_user_stats(s["contributor_id"])
        await notify(user["org_id"], s["contributor_id"],
                     f"Your solution was approved! +{r['bounty_credits']} credits", f"/requests/{r['id']}")
    elif payload.action == "reject":
        await db.requests_col.update_one({"id": r["id"]}, {"$set": {
            "status": "open", "claimed_by": None, "claimed_at": None, "updated_at": now_iso(),
        }})
        await notify(user["org_id"], s["contributor_id"],
                     f"Your solution was rejected: {r['title']}", f"/requests/{r['id']}")
    else:
        await db.requests_col.update_one({"id": r["id"]}, {"$set": {
            "status": "under_review", "updated_at": now_iso(),
        }})
        await notify(user["org_id"], s["contributor_id"],
                     f"Changes requested on: {r['title']}", f"/requests/{r['id']}")
    await log_audit(user["org_id"], user["id"], f"solution_{payload.action}", sid)
    return await db.solutions.find_one({"id": sid}, {"_id": 0})


# ===== FILES =====
@api.post("/files/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if file.size and file.size > 15 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 15MB)")
    ext = (file.filename or "bin").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    path = f"{APP_NAME}/{user['org_id']}/{user['id']}/{new_id()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    fid = new_id()
    doc = {
        "id": fid, "org_id": user["org_id"], "uploader_id": user["id"],
        "storage_path": result["path"], "original_filename": file.filename,
        "content_type": file.content_type, "size": result.get("size", len(data)),
        "is_deleted": False, "created_at": now_iso(),
    }
    await db.files.insert_one(doc)
    return {"id": fid, "filename": file.filename, "size": doc["size"],
            "content_type": doc["content_type"]}


@api.get("/files/{fid}/download")
async def download_file(fid: str, request: Request,
                        auth: Optional[str] = Query(None)):
    # allow query-token auth for <img src>
    if auth and not request.cookies.get("access_token"):
        request.cookies.__dict__.setdefault("_dict", {})
    # require auth: reuse dependency manually
    token = request.cookies.get("access_token") or auth
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
        org_id = payload["org"]
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    rec = await db.files.find_one({"id": fid, "org_id": org_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "File not found")
    data, ct = get_object(rec["storage_path"])
    return StreamingResponse(io.BytesIO(data),
                             media_type=rec.get("content_type") or ct,
                             headers={"Content-Disposition": f'inline; filename="{rec["original_filename"]}"'})


# ===== REWARDS =====
@api.get("/rewards")
async def list_rewards(user: dict = Depends(get_current_user)):
    items = await db.rewards.find({"org_id": user["org_id"], "active": True}, {"_id": 0}).to_list(500)
    return items


@api.post("/rewards")
async def create_reward(payload: RewardCreate, user: dict = Depends(require_role("admin"))):
    doc = {"id": new_id(), "org_id": user["org_id"], "name": payload.name,
           "credits": payload.credits, "image": payload.image, "stock": payload.stock,
           "active": True, "created_at": now_iso()}
    await db.rewards.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/rewards/redeem")
async def redeem(payload: RewardRedeem, user: dict = Depends(get_current_user)):
    reward = await db.rewards.find_one({"id": payload.reward_id, "org_id": user["org_id"]}, {"_id": 0})
    if not reward or not reward.get("active"):
        raise HTTPException(404, "Reward not available")
    if reward.get("stock", 0) <= 0:
        raise HTTPException(400, "Reward out of stock")
    balance = user.get("credits_earned", 0) - user.get("credits_redeemed", 0)
    if balance < reward["credits"]:
        raise HTTPException(400, f"Insufficient credits (need {reward['credits']}, have {balance})")
    await db.users.update_one({"id": user["id"]}, {"$inc": {"credits_redeemed": reward["credits"]}})
    await db.rewards.update_one({"id": reward["id"]}, {"$inc": {"stock": -1}})
    redemption = {
        "id": new_id(), "org_id": user["org_id"], "user_id": user["id"],
        "reward_id": reward["id"], "reward_name": reward["name"],
        "credits": reward["credits"], "status": "pending",
        "created_at": now_iso(),
    }
    await db.redemptions.insert_one(redemption)
    redemption.pop("_id", None)
    await db.transactions.insert_one({
        "id": new_id(), "org_id": user["org_id"], "source_user": user["id"],
        "destination_user": None, "credits": reward["credits"],
        "transaction_type": "redeem", "reason": f"Redeemed: {reward['name']}",
        "request_id": None, "timestamp": now_iso(),
    })
    await log_audit(user["org_id"], user["id"], "reward_redeemed", reward["id"])
    return redemption


@api.get("/redemptions")
async def my_redemptions(user: dict = Depends(get_current_user)):
    items = await db.redemptions.find({"org_id": user["org_id"], "user_id": user["id"]},
                                      {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


# ===== TRANSACTIONS =====
@api.get("/transactions/me")
async def my_transactions(user: dict = Depends(get_current_user)):
    items = await db.transactions.find({
        "org_id": user["org_id"],
        "$or": [{"source_user": user["id"]}, {"destination_user": user["id"]}],
    }, {"_id": 0}).sort("timestamp", -1).to_list(200)
    return items


# ===== LEADERBOARD =====
@api.get("/leaderboard")
async def leaderboard(scope: str = "global", period: str = "all",
                      user: dict = Depends(get_current_user)):
    flt = {"org_id": user["org_id"]}
    if scope == "department" and user.get("department"):
        flt["department"] = user["department"]
    users = await db.users.find(flt, {"_id": 0, "password_hash": 0}).to_list(1000)

    if period in ("monthly", "quarterly"):
        now = datetime.now(timezone.utc)
        days = 30 if period == "monthly" else 90
        cutoff = (now - timedelta(days=days)).isoformat()
        scored = []
        for u in users:
            agg = await db.transactions.aggregate([
                {"$match": {"destination_user": u["id"], "transaction_type": "earn",
                            "timestamp": {"$gte": cutoff}}},
                {"$group": {"_id": None, "total": {"$sum": "$credits"}}},
            ]).to_list(1)
            total = agg[0]["total"] if agg else 0
            scored.append({**public_user(u), "period_credits": total})
        scored.sort(key=lambda x: x["period_credits"], reverse=True)
        return scored[:100]

    out = [public_user(u) for u in users]
    out.sort(key=lambda x: (x["reputation_score"], x["credits_earned"]), reverse=True)
    return out[:100]


# ===== DASHBOARD =====
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    org_id = user["org_id"]
    total_requests = await db.requests_col.count_documents({"org_id": org_id})
    open_requests = await db.requests_col.count_documents({"org_id": org_id, "status": "open"})
    in_progress = await db.requests_col.count_documents({"org_id": org_id,
                                                          "status": {"$in": ["claimed", "in_progress", "submitted", "under_review"]}})
    completed = await db.requests_col.count_documents({"org_id": org_id, "status": "completed"})
    total_users = await db.users.count_documents({"org_id": org_id})
    agg = await db.transactions.aggregate([
        {"$match": {"org_id": org_id, "transaction_type": "earn"}},
        {"$group": {"_id": None, "total": {"$sum": "$credits"}}},
    ]).to_list(1)
    credits_awarded = agg[0]["total"] if agg else 0

    # active contributors (last 30 days)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    active = await db.transactions.distinct("destination_user", {
        "org_id": org_id, "transaction_type": "earn", "timestamp": {"$gte": cutoff}
    })

    # personal stats
    my_balance = user.get("credits_earned", 0) - user.get("credits_redeemed", 0)
    my_open = await db.requests_col.count_documents({"org_id": org_id, "creator_id": user["id"]})
    my_solved = await db.requests_col.count_documents({"org_id": org_id, "claimed_by": user["id"], "status": "completed"})

    # category breakdown
    cat_agg = await db.requests_col.aggregate([
        {"$match": {"org_id": org_id}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(20)

    # last 14 days activity
    activity = []
    for i in range(13, -1, -1):
        day = datetime.now(timezone.utc) - timedelta(days=i)
        start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        end = day.replace(hour=23, minute=59, second=59).isoformat()
        c = await db.requests_col.count_documents({"org_id": org_id,
                                                    "created_at": {"$gte": start, "$lte": end}})
        s = await db.requests_col.count_documents({"org_id": org_id, "status": "completed",
                                                    "completed_at": {"$gte": start, "$lte": end}})
        activity.append({"date": day.strftime("%b %d"), "created": c, "solved": s})

    return {
        "total_requests": total_requests, "open_requests": open_requests,
        "in_progress": in_progress, "completed": completed,
        "total_users": total_users, "credits_awarded": credits_awarded,
        "active_contributors": len(active),
        "participation_rate": round(len(active) / max(total_users, 1) * 100, 1),
        "my_balance": my_balance, "my_open": my_open, "my_solved": my_solved,
        "my_reputation": user.get("reputation_score", 0),
        "my_credits_earned": user.get("credits_earned", 0),
        "categories": [{"name": c["_id"], "count": c["count"]} for c in cat_agg],
        "activity": activity,
    }


# ===== NOTIFICATIONS =====
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"], "org_id": user["org_id"]},
                                        {"_id": 0}).sort("timestamp", -1).to_list(50)
    return items


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": nid, "user_id": user["id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False}, {"$set": {"read": True}}
    )
    return {"ok": True}


# ===== AUDIT (admin only) =====
@api.get("/audit-logs")
async def audit_logs(user: dict = Depends(require_role("admin", "manager"))):
    items = await db.audit_logs.find({"org_id": user["org_id"]}, {"_id": 0}) \
        .sort("timestamp", -1).to_list(200)
    user_ids = list({i["actor_id"] for i in items if i.get("actor_id")})
    users = await db.users.find({"id": {"$in": user_ids}},
                                {"_id": 0, "id": 1, "name": 1, "avatar_url": 1}).to_list(1000)
    umap = {u["id"]: u for u in users}
    for i in items:
        i["actor"] = umap.get(i.get("actor_id"))
    return items


@api.get("/health")
async def health():
    return {"ok": True, "ts": now_iso()}


# ----- Seed -----
async def seed():
    """Seed demo org + users + requests for instant demo."""
    domain = os.environ.get("SEED_ORG_DOMAIN", "acme.com").lower()
    org = await db.organizations.find_one({"domain": domain})
    if org:
        org_id = org["id"]
    else:
        org_id = new_id()
        await db.organizations.insert_one({
            "id": org_id, "name": os.environ.get("SEED_ORG_NAME", "Acme Corp"),
            "domain": domain, "logo": None, "credit_value_inr": 5,
            "categories": DEFAULT_CATEGORIES.copy(), "departments": DEFAULT_DEPARTMENTS.copy(),
            "created_at": now_iso(),
        })
        for r in DEFAULT_REWARDS:
            await db.rewards.insert_one({**r, "id": new_id(), "org_id": org_id, "active": True})

    seed_users = [
        ("admin@acme.com", "Admin@123", "Aisha Khan", "admin", "Operations", "Founder & CEO",
         ["operations", "leadership"], "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80"),
        ("manager@acme.com", "Manager@123", "Rohan Mehta", "manager", "Sales", "VP Sales",
         ["sales", "b2b", "saas"], "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80"),
        ("reviewer@acme.com", "Reviewer@123", "Sara Iyer", "reviewer", "Product", "Principal PM",
         ["product", "research", "fintech"], "https://images.unsplash.com/photo-1609436132311-e4b0c9370469?w=200&q=80"),
        ("priya@acme.com", "Priya@123", "Priya Sharma", "employee", "Engineering", "Senior Engineer",
         ["python", "fastapi", "ml", "fintech"], "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80"),
        ("arjun@acme.com", "Arjun@123", "Arjun Verma", "employee", "Marketing", "Growth Lead",
         ["growth", "seo", "consumer"], "https://images.unsplash.com/photo-1588178454780-441fa5b99fa5?w=200&q=80"),
    ]
    user_ids = {}
    for email, pwd, name, role, dept, designation, skills, avatar in seed_users:
        existing = await db.users.find_one({"email": email})
        if existing:
            user_ids[email] = existing["id"]
            if not verify_password(pwd, existing["password_hash"]):
                await db.users.update_one({"email": email},
                                          {"$set": {"password_hash": hash_password(pwd)}})
            continue
        uid = new_id()
        await db.users.insert_one({
            "id": uid, "org_id": org_id, "email": email,
            "password_hash": hash_password(pwd), "name": name, "role": role,
            "department": dept, "designation": designation,
            "expertise_tags": skills, "skills": skills, "avatar_url": avatar,
            "reputation_score": 0, "credits_earned": 0, "credits_redeemed": 0,
            "badges": [], "created_at": now_iso(),
        })
        user_ids[email] = uid

    # Seed sample requests if empty
    cnt = await db.requests_col.count_documents({"org_id": org_id})
    if cnt == 0:
        samples = [
            {"title": "Need introduction to someone who worked at Jio",
             "description": "Looking to understand telecom go-to-market strategy for our new product launch. Need a 30-min chat with anyone who has worked in product/strategy at Reliance Jio.",
             "category": "Business Introduction", "tags": ["telecom", "jio", "gtm"],
             "difficulty": "medium", "bounty_credits": 300, "creator_id": user_ids["admin@acme.com"],
             "department": "Sales", "status": "open"},
            {"title": "Vendor for industrial-grade IoT sensors (India)",
             "description": "We need a reliable vendor for ruggedized temperature + humidity sensors at scale (10k units/year). Bonus if they support OTA firmware updates.",
             "category": "Vendor Discovery", "tags": ["iot", "hardware", "india"],
             "difficulty": "hard", "bounty_credits": 500, "creator_id": user_ids["manager@acme.com"],
             "department": "Engineering", "status": "open"},
            {"title": "Market intel: D2C beauty TAM in Tier-2 India",
             "description": "Looking for credible 2024-25 reports or first-hand insights on TAM/SAM for D2C beauty in Tier-2 Indian cities.",
             "category": "Market Intelligence", "tags": ["d2c", "beauty", "research"],
             "difficulty": "medium", "bounty_credits": 250, "creator_id": user_ids["arjun@acme.com"],
             "department": "Marketing", "status": "claimed",
             "claimed_by": user_ids["priya@acme.com"], "claimed_at": now_iso()},
            {"title": "Senior backend engineer referral — Python/FastAPI",
             "description": "Hiring a senior backend engineer in Bangalore. Looking for trusted referrals (5+ yrs, Python, distributed systems).",
             "category": "Hiring", "tags": ["hiring", "python", "bangalore"],
             "difficulty": "easy", "bounty_credits": 800, "creator_id": user_ids["reviewer@acme.com"],
             "department": "Engineering", "status": "open"},
            {"title": "Legal review for our SaaS DPA template",
             "description": "Need someone with privacy/contracts expertise to review our DPA template before sharing with enterprise customers.",
             "category": "Legal Guidance", "tags": ["legal", "dpa", "saas"],
             "difficulty": "expert", "bounty_credits": 600, "creator_id": user_ids["admin@acme.com"],
             "department": "Operations", "status": "open"},
            {"title": "Intro to a CTO in fintech (Series B+)",
             "description": "Looking for a peer CTO at a Series B+ Indian fintech for a 30-min benchmarking call on observability + on-call.",
             "category": "Networking", "tags": ["cto", "fintech"],
             "difficulty": "medium", "bounty_credits": 400,
             "creator_id": user_ids["priya@acme.com"], "department": "Engineering",
             "status": "completed", "claimed_by": user_ids["manager@acme.com"],
             "claimed_at": now_iso(), "completed_at": now_iso()},
        ]
        for s in samples:
            s.update({
                "id": new_id(), "org_id": org_id, "visibility": "org",
                "view_count": 0, "due_date": None, "created_at": now_iso(),
                "updated_at": now_iso(),
            })
            s.setdefault("claimed_by", None)
            s.setdefault("claimed_at", None)
            s.setdefault("completed_at", None)
            await db.requests_col.insert_one(s)
            if s["status"] == "completed":
                await award_credits(org_id, s["claimed_by"], s["bounty_credits"],
                                     s["id"], f"Solved: {s['title']}")
                await recompute_user_stats(s["claimed_by"])
    logger.info("Seed complete")


@app.on_event("startup")
async def startup():
    # indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("org_id")
    await db.organizations.create_index("domain", unique=True)
    await db.requests_col.create_index([("org_id", 1), ("status", 1)])
    await db.requests_col.create_index([("org_id", 1), ("created_at", -1)])
    await db.solutions.create_index([("request_id", 1)])
    await db.transactions.create_index([("org_id", 1), ("destination_user", 1)])
    await db.notifications.create_index([("user_id", 1), ("timestamp", -1)])
    await db.files.create_index("id", unique=True)
    init_storage()
    await seed()
    logger.info("HiveMind backend ready.")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

origins = os.environ.get("CORS_ORIGINS", "*")
if origins == "*":
    # cookies with credentials require explicit origins — use regex to allow all
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in origins.split(",")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
