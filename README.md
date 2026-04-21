# 🦁 Simba 2.0 - Professional E-Commerce Platform

Simba 2.0 is a modernized, high-performance E-commerce platform designed with a focus on modularity, security, and a premium user experience. Built with a robust **FastAPI** backend and a sleek **React (Vite)** frontend, it offers a seamless shopping journey from product discovery to secure checkout.

---

## ✨ Key Features

### 🛠️ Architectural Excellence
- **Modular Profile System**: A clean, tab-based user dashboard for managing Personal Info, Order History, Wishlist, Addresses, and Payment Methods.
- **Hardened Checkout Flow**: A multi-step transaction process with real-time validation and error handling.
- **Standardized API**: Tagged and documented FastAPI endpoints for predictable service interaction.

### 🔐 Advanced Security & Auth
- **Full Auth Lifecycle**: Secure Registration, Login, and a robust Password Reset system.
- **Email Verification**: Built-in logic for account verification with a local "Development Mailbox" for instant link access.
- **Type-Safe Hydration**: Real-time user profile synchronization to ensure consistent UI state.

### 🛒 Premium Shopping Experience
- **Dynamic Product Catalog**: 789+ seeded items with multi-word search and category filtering.
- **Intelligent Notifications**: Real-time alerts for price drops on wishlist items and restock notifications.
- **Glassmorphic UI**: Ultra-modern design using Tailwind CSS and Framer Motion for smooth, premium interactions.

---

## 🚀 Tech Stack

### Backend
- **Core**: Python (FastAPI)
- **Database**: SQLAlchemy (SQLite)
- **Security**: JWT-based Authentication, Argon2 Hashing
- **Validation**: Pydantic Models

### Frontend
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS, Shadcn/UI
- **Animations**: Framer Motion
- **State Management**: TanStack Query (React Query), React Context API

---

## 🛠️ Getting Started

### 1. Clone the Repository
```bash
git clone git@github.com:mug1sha/Simba-2.0.git
cd "Simba 2.0"
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```
*The backend will be available at http://localhost:8000*

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*The frontend will start at http://localhost:8083 (or available port)*

---

## 📬 Development "Mailbox"
During local development, verification and reset emails are mocked to prevent spam and allow for instant testing.
- **Terminal**: Check the backend console output.
- **Log File**: Open `backend/dev_mailbox.log` to find and click your latest links.

---

## 📂 Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── auth.py          # Security logic
│   │   ├── crud.py          # Database interactions
│   │   ├── main.py          # API Endpoints
│   │   ├── models.py        # SQLAlchemy Tables
│   │   └── schemas.py       # Pydantic Types
│   └── dev_mailbox.log      # Local email log
├── frontend/
│   ├── src/
│   │   ├── components/      # UI Modules
│   │   ├── contexts/        # App State
│   │   ├── lib/             # API Helpers
│   │   └── pages/           # View Layouts
└── README.md
```

---

## 📜 License
This project is part of the Simba Modernization Audit. All rights reserved.
