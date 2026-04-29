# Brevo Email Setup

This project can send real verification and password reset emails through Brevo SMTP.

## 1. Create Or Open Brevo

Create a Brevo account, then open the Brevo dashboard.

## 2. Authenticate Your Sending Domain

In Brevo, go to:

`Settings -> Senders, Domains, IPs -> Domains`

Add the domain you want to send from, for example:

`your-domain.com`

Brevo will ask you to authenticate the domain. Use automatic authentication if your DNS provider is supported. Otherwise, copy the DNS records Brevo gives you into your domain provider:

- Brevo TXT code
- DKIM record
- DMARC TXT record

DNS can take up to 48 hours to fully propagate, but it is often faster.

## 3. Create A Transactional Sender

In Brevo, add a sender that uses the authenticated domain:

`no-reply@your-domain.com`

Use this same address for `EMAIL_FROM`.

## 4. Create SMTP Credentials

In Brevo, open the SMTP/API area and create an SMTP key.

Use SMTP credentials, not an API key:

- SMTP server: `smtp-relay.brevo.com`
- SMTP port: `587`
- SMTP user: your Brevo SMTP login
- SMTP password: your Brevo SMTP key
- Encryption: STARTTLS

## 5. Configure Backend

Create `backend/.env` from `backend/.env.example` and set:

```env
APP_ENV=development
SECRET_KEY=replace-with-a-strong-random-secret
DATABASE_URL=sqlite:///./simba.db

FRONTEND_URL=http://127.0.0.1:8080
CORS_ORIGINS=http://127.0.0.1:8080,http://localhost:8080

EMAIL_FROM=no-reply@your-domain.com
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-smtp-login
SMTP_PASSWORD=your-brevo-smtp-key
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

`FRONTEND_URL` is automatically included in the backend CORS allowlist. Add any secondary frontend or preview origins to `CORS_ORIGINS`.

For production, set:

```env
APP_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGINS=https://your-frontend-domain.com
```

## 6. Test The Flow

Start the backend and frontend:

```bash
cd backend
venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 8080
```

Then test:

1. Open `http://127.0.0.1:8080/`.
2. Sign up with a real inbox email.
3. Check your inbox for the verification email.
4. Click the verification link.
5. Log in.
6. Test forgot password and reset password.

If SMTP variables are missing, the app falls back to `backend/dev_mailbox.log` and exposes local dev links. If SMTP variables are present, Brevo sends real email.
