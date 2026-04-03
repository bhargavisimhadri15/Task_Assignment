# Backend (Node.js + Express + MongoDB + JWT)

## Requirements
- Node.js 18+ (tested with Node 20)
- Local MongoDB running on `mongodb://localhost:27017`

## Setup
- `cd backend`
- `npm install`

## Run
- `npm start`

## Posts APIs (Protected)
- `GET /api/posts` (supports `page` and `limit`)
- `GET /api/posts?category=technology` (filter by `general|technology`)
- `GET /api/posts/:id`
- `POST /api/posts`
- `PUT /api/posts/:id`
- `DELETE /api/posts/:id`

## JWT Auth
- Login/Register returns `access_token`.
- Send it on protected routes: `Authorization: Bearer <access_token>`
- Refresh supports cookies, `Authorization: Bearer <refresh_token>`, or JSON body `{ "refresh_token": "..." }`

Important:
- Create/Update operations write to the local MongoDB `posts` collection only.
- JSONPlaceholder is used only for **read-only seeding** into `seeded_*` collections.
