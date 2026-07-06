# Multi-Tenant LMS Backend

This is the backend for a multi-tenant Learning Management System, built with Next.js 15, Drizzle ORM, Neon PostgreSQL, and custom JWT authentication.

## Tech Stack
- **Framework**: Next.js 15 (App Router, strict TypeScript)
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Drizzle ORM
- **Auth**: Custom JWT (jose), Argon2id (`@node-rs/argon2`)
- **Validation**: Zod
- **Rate Limiting**: Upstash Redis
- **File Storage**: Cloudflare R2
- **Email**: Resend + React Email

## Setup Instructions

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env` and fill in your credentials (Neon, Resend, Upstash, R2, JWT secret).
   ```bash
   cp .env.example .env
   ```

3. **Database Migrations**
   Generate and push the schema to your Neon database:
   ```bash
   npx drizzle-kit generate
   npx drizzle-kit push
   ```

4. **Create Super Admin**
   Run the CLI script to bootstrap the initial super admin:
   ```bash
   SUPER_ADMIN_EMAIL=admin@myapp.pk \
   SUPER_ADMIN_PASSWORD=securepassword123 \
   SUPER_ADMIN_SECURITY_QUESTION="What is your favorite color?" \
   SUPER_ADMIN_SECURITY_ANSWER="Blue" \
   npx tsx scripts/create-super-admin.ts
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

## API Endpoints Overview

| Route | Method | Roles Allowed | Description |
|---|---|---|---|
| `/api/health` | GET | Public | Health check |
| `/api/auth/login` | POST | Public | Login (returns JWT in cookies) |
| `/api/auth/logout` | POST | Authenticated | Clears cookies |
| `/api/auth/refresh` | POST | Authenticated | Rotates refresh token |
| `/api/auth/change-password` | POST | EMPLOYEE, STAFF, STUDENT | Change password |
| `/api/institution/register` | POST | Public | Self-registration for institutions |
| `/api/admin/employees` | POST, GET | SUPER_ADMIN | Manage employees |
| `/api/employee/institutions/[id]/review` | POST | SUPER_ADMIN, EMPLOYEE | Approve/Reject institutions |
| `/api/institution/staff` | POST | INSTITUTION | Create staff |
| `/api/institution/students` | POST | INSTITUTION | Create students |
| `/api/institution/dashboard` | GET | INSTITUTION | Fetch counts |
| `/api/staff/timetable` | GET | STAFF | Fetch staff timetable |
| `/api/student/timetable` | GET | STUDENT | Fetch student timetable |

*(More CRUD endpoints for classes, sections, subjects, announcements, attendance, and marks follow similar RBAC patterns).*
