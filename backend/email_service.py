"""SMTP email notifications for Jugaad."""
import asyncio
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Iterable

logger = logging.getLogger("hivemind.mail")


def app_name() -> str:
    return os.environ.get("APP_NAME", "Jugaad")


def mail_enabled() -> bool:
    return os.environ.get("MAIL_ENABLED", "false").lower() in ("1", "true", "yes")


def _smtp_config() -> dict | None:
    host = os.environ.get("SMTP_HOST", "").strip()
    if not host:
        return None
    return {
        "host": host,
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER", "").strip(),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "from_addr": os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "noreply@hivemind.local")),
        "use_tls": os.environ.get("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes"),
    }


def _send_one(cfg: dict, to_addr: str, subject: str, html: str, text: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg["from_addr"]
    msg["To"] = to_addr
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(cfg["host"], cfg["port"], timeout=30) as smtp:
        if cfg["use_tls"]:
            smtp.starttls()
        if cfg["user"]:
            smtp.login(cfg["user"], cfg["password"])
        smtp.sendmail(cfg["from_addr"], [to_addr], msg.as_string())


def send_to_many(recipients: Iterable[str], subject: str, html: str, text: str) -> int:
    """Send the same message to each recipient. Returns count sent."""
    if not mail_enabled():
        logger.info("MAIL_ENABLED is false — skipping email send")
        return 0

    cfg = _smtp_config()
    if not cfg:
        logger.warning("SMTP_HOST not configured — skipping email send")
        return 0

    unique = sorted({e.strip().lower() for e in recipients if e and "@" in e})
    if not unique:
        logger.warning("No valid recipient emails")
        return 0

    sent = 0
    for addr in unique:
        try:
            _send_one(cfg, addr, subject, html, text)
            sent += 1
        except Exception as exc:
            logger.error("Failed to send email to %s: %s", addr, exc)
    logger.info("Sent '%s' to %d/%d recipients", subject, sent, len(unique))
    return sent


def build_new_request_email(
    *,
    org_name: str,
    creator_name: str,
    title: str,
    description: str,
    category: str,
    bounty_credits: int,
    difficulty: str,
    request_id: str,
    app_url: str,
) -> tuple[str, str, str]:
    link = f"{app_url.rstrip('/')}/app/requests/{request_id}"
    subject = f"[{org_name}] New request: {title}"
    text = (
        f"A new request was posted in {org_name}.\n\n"
        f"Title: {title}\n"
        f"Category: {category}\n"
        f"Difficulty: {difficulty}\n"
        f"Bounty: {bounty_credits} credits\n"
        f"Posted by: {creator_name}\n\n"
        f"{description[:500]}{'…' if len(description) > 500 else ''}\n\n"
        f"View and claim: {link}\n"
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#2563eb">
        {org_name} · {app_name()}
      </p>
      <h2 style="margin:0 0 8px;font-size:22px">New request posted</h2>
      <p style="color:#475569;margin:0 0 16px">Posted by <strong>{creator_name}</strong></p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:20px">
        <h3 style="margin:0 0 8px;font-size:18px">{title}</h3>
        <p style="margin:0 0 12px;color:#334155;white-space:pre-wrap">{description[:800]}</p>
        <p style="margin:0;font-size:13px;color:#64748b">
          {category} · {difficulty} · <strong>{bounty_credits} credits</strong>
        </p>
      </div>
      <a href="{link}"
         style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                padding:12px 20px;border-radius:8px;font-weight:600">
        View &amp; claim request
      </a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8">
        You received this because you are a member of {org_name}.
      </p>
    </div>
    """
    return subject, html, text


async def notify_org_new_request(db, org_id: str, request: dict, creator: dict) -> None:
    """Email all org members when a new ticket is created."""
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1})
    org_name = (org or {}).get("name") or "Your organization"

    flt = {"org_id": org_id}
    if request.get("visibility") == "department" and request.get("department"):
        flt["$or"] = [
            {"department": request["department"]},
            {"role": "admin"},
        ]

    users = await db.users.find(flt, {"_id": 0, "email": 1}).to_list(2000)
    emails = [u["email"] for u in users if u.get("email")]

    app_url = os.environ.get("APP_URL", "http://localhost:8090")
    subject, html, text = build_new_request_email(
        org_name=org_name,
        creator_name=creator.get("name", "A colleague"),
        title=request["title"],
        description=request.get("description", ""),
        category=request.get("category", "General"),
        bounty_credits=request.get("bounty_credits", 0),
        difficulty=request.get("difficulty", "medium"),
        request_id=request["id"],
        app_url=app_url,
    )
    await asyncio.to_thread(send_to_many, emails, subject, html, text)


def build_verification_email(name: str, verify_url: str) -> tuple[str, str, str]:
    brand = app_name()
    subject = f"Verify your {brand} email"
    text = (
        f"Hi {name},\n\n"
        f"Please verify your email address to unlock full access on {brand}.\n\n"
        f"Click this link (valid for 24 hours):\n{verify_url}\n\n"
        f"If you did not create an account, you can ignore this email.\n"
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#2563eb">{brand}</p>
      <h2 style="margin:0 0 8px;font-size:22px">Verify your email</h2>
      <p style="color:#475569;margin:0 0 16px">Hi {name}, confirm your email to claim tickets and redeem rewards.</p>
      <a href="{verify_url}"
         style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                padding:12px 20px;border-radius:8px;font-weight:600">
        Verify email address
      </a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8">
        Or copy this link: {verify_url}
      </p>
    </div>
    """
    return subject, html, text


def send_verification_email(to_addr: str, name: str, raw_token: str) -> int:
    app_url = os.environ.get("APP_URL", "http://localhost:8090")
    verify_url = f"{app_url.rstrip('/')}/verify-email?token={raw_token}"
    subject, html, text = build_verification_email(name or "there", verify_url)
    return send_to_many([to_addr], subject, html, text)
