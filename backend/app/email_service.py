import secrets
import logging

logger = logging.getLogger(__name__)

def generate_token():
    """Generates a secure random token."""
    return secrets.token_urlsafe(32)

def send_verification_email(email: str, token: str):
    """Mocks sending a verification email by logging the link and writing to dev_mailbox.log."""
    verification_link = f"http://localhost:8083/verify-email?token={token}"
    
    mail_content = f"""
==================================================
📧 EMAIL TO: {email}
Subject: Verify your Simba Account
🔗 {verification_link}
==================================================
"""
    print(mail_content)
    with open("dev_mailbox.log", "a") as f:
        f.write(mail_content)
    
    logger.info(f"Verification email sent to {email}")

def send_reset_password_email(email: str, token: str):
    """Mocks sending a password reset email by logging the link and writing to dev_mailbox.log."""
    reset_link = f"http://localhost:8083/reset-password?token={token}"
    
    mail_content = f"""
==================================================
📧 EMAIL TO: {email}
Subject: Password Reset Request for Simba
🔗 {reset_link}
==================================================
"""
    print(mail_content)
    with open("dev_mailbox.log", "a") as f:
        f.write(mail_content)
    
    logger.info(f"Password reset email sent to {email}")
