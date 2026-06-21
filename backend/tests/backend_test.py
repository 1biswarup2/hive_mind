"""HiveMind backend integration tests — runs against public REACT_APP_BACKEND_URL.

Covers: auth/cookies, multi-tenant isolation, requests CRUD + lifecycle,
solutions review (approve/reject/request_changes), rewards redemption,
leaderboard, dashboard, admin RBAC, audit logs, notifications, files.
"""
import os
import io
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://expertise-market.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@acme.com", "password": "Admin@123"}
PRIYA = {"email": "priya@acme.com", "password": "Priya@123"}
ARJUN = {"email": "arjun@acme.com", "password": "Arjun@123"}
MANAGER = {"email": "manager@acme.com", "password": "Manager@123"}


def _sess(creds=None):
    s = requests.Session()
    if creds:
        r = s.post(f"{API}/auth/login", json=creds, timeout=30)
        assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def admin_sess():
    return _sess(ADMIN)


@pytest.fixture(scope="session")
def priya_sess():
    return _sess(PRIYA)


@pytest.fixture(scope="session")
def arjun_sess():
    return _sess(ARJUN)


# ----------------- AUTH -----------------
class TestAuth:
    def test_login_sets_cookies(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == ADMIN["email"]
        assert data["user"]["role"] == "admin"
        assert data["org"]["domain"] == "acme.com"
        # cookies
        cookies = {c.name: c for c in s.cookies}
        assert "access_token" in cookies and "refresh_token" in cookies

    def test_me_returns_user(self, admin_sess):
        r = admin_sess.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == ADMIN["email"]

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@acme.com", "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_logout_clears(self):
        s = _sess(ADMIN)
        r = s.post(f"{API}/auth/logout", timeout=30)
        assert r.status_code == 200
        r2 = s.get(f"{API}/auth/me", timeout=30)
        assert r2.status_code == 401

    def test_register_org_and_isolation(self):
        domain = f"test{uuid.uuid4().hex[:8]}.com"
        payload = {
            "org_name": "TestOrg", "org_domain": domain,
            "admin_name": "TEST_Admin",
            "admin_email": f"TEST_admin@{domain}",
            "admin_password": "TestPass@123",
        }
        s = requests.Session()
        r = s.post(f"{API}/auth/register-org", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["role"] == "admin"
        assert body["org"]["domain"] == domain
        # default rewards seeded (8)
        rew = s.get(f"{API}/rewards", timeout=30)
        assert rew.status_code == 200
        assert len(rew.json()) == 8

        # multi-tenant isolation: should not see acme's users/requests
        users = s.get(f"{API}/users", timeout=30).json()
        emails = [u["email"] for u in users]
        assert "admin@acme.com" not in emails
        reqs = s.get(f"{API}/requests", timeout=30).json()
        assert all(r2.get("org_id") == body["org"]["id"] for r2 in reqs)

    def test_register_employee_in_org(self):
        email = f"TEST_emp_{uuid.uuid4().hex[:6]}@acme.com"
        r = requests.post(f"{API}/auth/register", json={
            "org_domain": "acme.com", "name": "TEST Employee",
            "email": email, "password": "TestPass@123",
        }, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "employee"


# ----------------- REQUESTS / LIFECYCLE -----------------
class TestRequestsLifecycle:
    def test_list_seeded(self, admin_sess):
        r = admin_sess.get(f"{API}/requests", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 6
        # filters
        r2 = admin_sess.get(f"{API}/requests", params={"status": "open"}, timeout=30)
        assert all(x["status"] == "open" for x in r2.json())
        r3 = admin_sess.get(f"{API}/requests", params={"q": "Jio"}, timeout=30)
        assert any("Jio" in (x["title"] + x["description"]) for x in r3.json())
        r4 = admin_sess.get(f"{API}/requests", params={"category": "Hiring"}, timeout=30)
        assert all(x["category"] == "Hiring" for x in r4.json())

    def test_full_lifecycle_approve(self, admin_sess, priya_sess):
        # create new request as admin
        title = f"TEST_lifecycle_{uuid.uuid4().hex[:6]}"
        body = {"title": title, "description": "test desc",
                "category": "General Help", "tags": ["test"],
                "difficulty": "easy", "bounty_credits": 50}
        r = admin_sess.post(f"{API}/requests", json=body, timeout=30)
        assert r.status_code == 200
        rid = r.json()["id"]

        # priya claims
        r = priya_sess.post(f"{API}/requests/{rid}/claim", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "claimed"

        # priya submits solution
        r = priya_sess.post(f"{API}/requests/{rid}/solutions",
                            json={"submission_text": "solved it", "links": ["http://x"]}, timeout=30)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]

        # request status now submitted
        r = admin_sess.get(f"{API}/requests/{rid}", timeout=30)
        assert r.json()["status"] == "submitted"

        # priya's credits & rep BEFORE approval
        priya_id = priya_sess.get(f"{API}/auth/me", timeout=30).json()["user"]["id"]
        before = admin_sess.get(f"{API}/users/{priya_id}", timeout=30).json()
        before_credits = before["credits_earned"]

        # admin approves
        r = admin_sess.post(f"{API}/solutions/{sid}/review",
                            json={"action": "approve"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "approved"

        # request now completed
        r = admin_sess.get(f"{API}/requests/{rid}", timeout=30)
        assert r.json()["status"] == "completed"

        # priya credits increased
        after = admin_sess.get(f"{API}/users/{priya_id}", timeout=30).json()
        assert after["credits_earned"] == before_credits + 50

        # transaction
        txs = priya_sess.get(f"{API}/transactions/me", timeout=30).json()
        assert any(t["transaction_type"] == "earn" and t["request_id"] == rid for t in txs)

        # notification to priya
        notifs = priya_sess.get(f"{API}/notifications", timeout=30).json()
        assert any("approved" in n["message"].lower() for n in notifs)

    def test_review_reject_reopens(self, admin_sess, priya_sess):
        title = f"TEST_reject_{uuid.uuid4().hex[:6]}"
        rid = admin_sess.post(f"{API}/requests", json={
            "title": title, "description": "x", "category": "General Help",
            "bounty_credits": 10}, timeout=30).json()["id"]
        priya_sess.post(f"{API}/requests/{rid}/claim", timeout=30)
        sid = priya_sess.post(f"{API}/requests/{rid}/solutions",
                              json={"submission_text": "weak"}, timeout=30).json()["id"]
        r = admin_sess.post(f"{API}/solutions/{sid}/review",
                            json={"action": "reject", "feedback": "no"}, timeout=30)
        assert r.status_code == 200
        req = admin_sess.get(f"{API}/requests/{rid}", timeout=30).json()
        assert req["status"] == "open"
        assert req.get("claimed_by") in (None,)

    def test_review_request_changes(self, admin_sess, priya_sess):
        title = f"TEST_changes_{uuid.uuid4().hex[:6]}"
        rid = admin_sess.post(f"{API}/requests", json={
            "title": title, "description": "x", "category": "General Help",
            "bounty_credits": 10}, timeout=30).json()["id"]
        priya_sess.post(f"{API}/requests/{rid}/claim", timeout=30)
        sid = priya_sess.post(f"{API}/requests/{rid}/solutions",
                              json={"submission_text": "draft"}, timeout=30).json()["id"]
        r = admin_sess.post(f"{API}/solutions/{sid}/review",
                            json={"action": "request_changes"}, timeout=30)
        assert r.status_code == 200
        req = admin_sess.get(f"{API}/requests/{rid}", timeout=30).json()
        assert req["status"] == "under_review"


# ----------------- REWARDS -----------------
class TestRewards:
    def test_list_8_rewards(self, admin_sess):
        r = admin_sess.get(f"{API}/rewards", timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 8

    def test_redeem_insufficient(self, arjun_sess):
        rewards = arjun_sess.get(f"{API}/rewards", timeout=30).json()
        # pick most expensive
        rw = max(rewards, key=lambda x: x["credits"])
        r = arjun_sess.post(f"{API}/rewards/redeem", json={"reward_id": rw["id"]}, timeout=30)
        assert r.status_code == 400

    def test_redeem_success(self, admin_sess, priya_sess):
        # Make sure priya has credits (from earlier approval) — give some via new lifecycle
        # find cheap reward
        rewards = priya_sess.get(f"{API}/rewards", timeout=30).json()
        cheap = min(rewards, key=lambda x: x["credits"])
        priya_id = priya_sess.get(f"{API}/auth/me", timeout=30).json()["user"]["id"]
        balance = priya_sess.get(f"{API}/users/{priya_id}", timeout=30).json()["credits_balance"]
        if balance < cheap["credits"]:
            # earn via admin-created request lifecycle
            title = f"TEST_topup_{uuid.uuid4().hex[:6]}"
            rid = admin_sess.post(f"{API}/requests", json={
                "title": title, "description": "x", "category": "General Help",
                "bounty_credits": cheap["credits"] + 10}, timeout=30).json()["id"]
            priya_sess.post(f"{API}/requests/{rid}/claim", timeout=30)
            sid = priya_sess.post(f"{API}/requests/{rid}/solutions",
                                  json={"submission_text": "done"}, timeout=30).json()["id"]
            admin_sess.post(f"{API}/solutions/{sid}/review", json={"action": "approve"}, timeout=30)

        before = priya_sess.get(f"{API}/users/{priya_id}", timeout=30).json()
        r = priya_sess.post(f"{API}/rewards/redeem", json={"reward_id": cheap["id"]}, timeout=30)
        assert r.status_code == 200, r.text
        after = priya_sess.get(f"{API}/users/{priya_id}", timeout=30).json()
        assert after["credits_redeemed"] == before["credits_redeemed"] + cheap["credits"]


# ----------------- LEADERBOARD -----------------
class TestLeaderboard:
    def test_global_all(self, admin_sess):
        r = admin_sess.get(f"{API}/leaderboard", params={"scope": "global", "period": "all"}, timeout=30)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        if len(arr) >= 2:
            # sorted by rep desc
            for i in range(len(arr) - 1):
                assert arr[i]["reputation_score"] >= arr[i + 1]["reputation_score"]

    def test_monthly(self, admin_sess):
        r = admin_sess.get(f"{API}/leaderboard", params={"period": "monthly"}, timeout=30)
        assert r.status_code == 200
        for u in r.json():
            assert "period_credits" in u


# ----------------- DASHBOARD -----------------
class TestDashboard:
    def test_stats(self, admin_sess):
        r = admin_sess.get(f"{API}/dashboard/stats", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_requests", "open_requests", "completed", "credits_awarded",
                  "participation_rate", "categories", "activity"]:
            assert k in d
        assert len(d["activity"]) == 14


# ----------------- ADMIN RBAC -----------------
class TestRBAC:
    def test_non_admin_cannot_change_role(self, priya_sess, admin_sess):
        users = admin_sess.get(f"{API}/users", timeout=30).json()
        arjun = next(u for u in users if u["email"] == "arjun@acme.com")
        r = priya_sess.patch(f"{API}/users/{arjun['id']}/role",
                             json={"role": "manager"}, timeout=30)
        assert r.status_code == 403

    def test_admin_can_change_role_and_revert(self, admin_sess):
        users = admin_sess.get(f"{API}/users", timeout=30).json()
        arjun = next(u for u in users if u["email"] == "arjun@acme.com")
        original = arjun["role"]
        r = admin_sess.patch(f"{API}/users/{arjun['id']}/role",
                             json={"role": "reviewer"}, timeout=30)
        assert r.status_code == 200
        # revert
        admin_sess.patch(f"{API}/users/{arjun['id']}/role",
                         json={"role": original}, timeout=30)

    def test_non_admin_cannot_add_category(self, priya_sess):
        r = priya_sess.post(f"{API}/org/categories",
                            json={"name": "TEST_blocked"}, timeout=30)
        assert r.status_code == 403

    def test_admin_can_add_category_and_update_org(self, admin_sess):
        cname = f"TEST_cat_{uuid.uuid4().hex[:6]}"
        r = admin_sess.post(f"{API}/org/categories", json={"name": cname}, timeout=30)
        assert r.status_code == 200
        assert cname in r.json()
        r2 = admin_sess.patch(f"{API}/org", json={"credit_value_inr": 5}, timeout=30)
        assert r2.status_code == 200


# ----------------- AUDIT / NOTIF -----------------
class TestAuditAndNotif:
    def test_audit_logs(self, admin_sess):
        r = admin_sess.get(f"{API}/audit-logs", timeout=30)
        assert r.status_code == 200
        actions = {x["action"] for x in r.json()}
        # should include some lifecycle entries
        assert len(actions) >= 1

    def test_audit_logs_blocked_for_employee(self, priya_sess):
        r = priya_sess.get(f"{API}/audit-logs", timeout=30)
        assert r.status_code == 403

    def test_notifications_read_all(self, priya_sess):
        r = priya_sess.post(f"{API}/notifications/read-all", timeout=30)
        assert r.status_code == 200
        notifs = priya_sess.get(f"{API}/notifications", timeout=30).json()
        assert all(n["read"] for n in notifs)


# ----------------- FILE UPLOAD (best-effort; storage may be unavailable) -----------------
class TestFiles:
    def test_upload_or_503(self, admin_sess):
        files = {"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")}
        r = admin_sess.post(f"{API}/files/upload", files=files, timeout=60)
        if r.status_code == 503:
            pytest.skip("Object storage unavailable (known external dependency)")
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        # download
        d = admin_sess.get(f"{API}/files/{fid}/download", timeout=60)
        assert d.status_code == 200
        # cross-org access denied
        domain = f"crossorg{uuid.uuid4().hex[:6]}.com"
        s2 = requests.Session()
        s2.post(f"{API}/auth/register-org", json={
            "org_name": "X", "org_domain": domain, "admin_name": "X",
            "admin_email": f"TEST_x@{domain}", "admin_password": "TestPass@123",
        }, timeout=30)
        d2 = s2.get(f"{API}/files/{fid}/download", timeout=30)
        assert d2.status_code == 404
