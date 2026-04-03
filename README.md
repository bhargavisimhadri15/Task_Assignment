# Task Assignment (MERN)

Task Assignment is a full-stack app with JWT authentication, profile management, and a posts dashboard (CRUD + search + pagination).

Repo structure:
- `backend/`: Node.js + Express + MongoDB + JWT
- `frontend/`: React (CRACO) + Tailwind

## Features
- Auth: register/login/logout/refresh + current user (`/api/auth/me`)
- Posts: list/search/paginate + category filter (`general`, `technology`)
- Posts CRUD: create/update/delete only by the post owner
- Profile: view/update self + delete account (also deletes your posts)
- Password reset: `forgot-password` + `reset-password` (dev can return token)

## Prerequisites
- Node.js 18+
- MongoDB running locally (recommended)

## Quickstart (two terminals)
1. Create env files:
   - `backend/.env`: copy from `backend/.env.example`
   - `frontend/.env`: copy from `frontend/.env.example`
2. Start backend:
```bash
cd backend
npm install
npm start
```
3. Start frontend:
```bash
cd frontend
npm install
npm start
```

Defaults:
- Backend: `http://localhost:8001`
- Frontend: `http://localhost:3000`

Test credentials: `backend/test_credentials.md`.

## Environment variables
Backend (`backend/.env`):
- `MONGO_URL` (default `mongodb://localhost:27017`)
- `DB_NAME` (optional)
- `PORT` (default `8000`)
- `CORS_ORIGINS` (comma-separated or `*`)
- `JWT_SECRET` (set this)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed admin user)
- `DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_NAME` (seed demo user)
- `RETURN_RESET_TOKEN=1` (dev-only)

Frontend (`frontend/.env`):
- `REACT_APP_BACKEND_URL` (example `http://localhost:8001`)

## API (backend)
Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Posts (protected):
- `GET /api/posts` (query: `page`, `limit`, `search`, `category`)
- `GET /api/posts/:id`
- `POST /api/posts`
- `PUT /api/posts/:id`
- `DELETE /api/posts/:id`

Profile (protected):
- `GET /api/users/me`
- `PUT /api/users/me`
- `DELETE /api/users/me`

Seed/demo data:
- On startup, the backend attempts to seed JSONPlaceholder data into `seeded_*` collections.
- `POST /api/seed` triggers seeding on demand.

