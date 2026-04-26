import secrets
import logging
import os
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:8080")
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes", "on"}
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "false").lower() in {"1", "true", "yes", "on"}
SMTP_TIMEOUT = int(os.getenv("SMTP_TIMEOUT", "15"))
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER or "no-reply@simba.local")
DEV_MAILBOX_PATH = Path(os.getenv("DEV_MAILBOX_PATH", "dev_mailbox.log"))

def generate_token():
    """Generates a secure random token."""
    return secrets.token_urlsafe(32)

def smtp_configured():
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)

def deliver_email(email: str, subject: str, text_body: str, html_body: Optional[str] = None, preview_url: Optional[str] = None):
    """Send email through SMTP when configured, otherwise write to the local dev mailbox."""
    if smtp_configured():
        message = EmailMessage()
        message["From"] = EMAIL_FROM
        message["To"] = email
        message["Subject"] = subject
        message.set_content(text_body)
        if html_body:
            message.add_alternative(html_body, subtype="html")

        smtp_cls = smtplib.SMTP_SSL if SMTP_USE_SSL else smtplib.SMTP
        with smtp_cls(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT) as smtp:
            if SMTP_USE_TLS and not SMTP_USE_SSL:
                smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(message)
        logger.info("Email sent to %s via SMTP", email)
        return {"delivery": "smtp", "preview_url": None}

    DEV_MAILBOX_PATH.parent.mkdir(parents=True, exist_ok=True)
    with DEV_MAILBOX_PATH.open("a", encoding="utf-8") as f:
        f.write(text_body)
    print(text_body)
    logger.info("Email written to development mailbox for %s", email)
    return {"delivery": "dev_mailbox", "preview_url": preview_url}

def send_verification_email(email: str, token: str):
    """Send a verification email or write it to the development mailbox."""
    verification_link = f"{FRONTEND_URL}/verify-email?token={token}"
    
    text_body = f"""
==================================================
EMAIL TO: {email}
Subject: Verify your Simba Account
{verification_link}
==================================================
"""
    html_body = f"""
    <p>Welcome to Simba.</p>
    <p>Verify your email address to activate your account:</p>
    <p><a href="{verification_link}">Verify email</a></p>
    <p>If the button does not work, copy this link: {verification_link}</p>
    """
    return deliver_email(email, "Verify your Simba Account", text_body, html_body, verification_link)

def send_reset_password_email(email: str, token: str):
    """Send a password reset email or write it to the development mailbox."""
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    
    text_body = f"""
==================================================
EMAIL TO: {email}
Subject: Password Reset Request for Simba
{reset_link}
==================================================
"""
    html_body = f"""
    <p>We received a request to reset your Simba password.</p>
    <p><a href="{reset_link}">Reset password</a></p>
    <p>If you did not request this, you can ignore this email.</p>
    <p>If the button does not work, copy this link: {reset_link}</p>
    """
    return deliver_email(email, "Password Reset Request for Simba", text_body, html_body, reset_link)

def build_invite_link(token: str):
    return f"{FRONTEND_URL}/invite?token={token}"

def read_dev_mailbox():
    if not DEV_MAILBOX_PATH.exists():
        return ""
    return DEV_MAILBOX_PATH.read_text(encoding="utf-8")
