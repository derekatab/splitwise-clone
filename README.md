# Project Summary

A full‑stack web application for groups to track and settle shared expenses. An admin creates trips and invites participants by email; invited users join, add expenses, and the app automatically splits costs among trip members. All amounts are converted to Canadian dollars and the app maintains per‑user balances and who owes whom.

## Tech highlights
- Email delivery via SMTP (Gmail app password)
- External currency conversion API for rates

## Quick start
- Create Postgres DB and set DATABASE_URL
- Configure EXCHANGE_RATE_API_KEY, SMTP_* variables, ADMIN_SECRET_KEY, NEXT_PUBLIC_APP_URL
- Run the app in development (localhost:3000) and invite users to test expense sharing

# Environment Variables

## Database
 DATABASE_URL
```env
DATABASE_URL=postgresql://username:password@localhost:5432/splitwise_clone
```

## Currency Conversion API
 EXCHANGE_RATE_API_KEY
```env
EXCHANGE_RATE_API_KEY=your_api_key_here
```
- How to get: sign up at https://www.exchangerate-api.com/ and copy the API key from the dashboard.

## Email (Gmail SMTP)
SMTP settings
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Splitwise
```
- How to set up: enable 2-Step Verification on your Gmail account and generate an app password (use that 16-character app password as `SMTP_PASS`). See:
    - https://myaccount.google.com/security
    - https://myaccount.google.com/apppasswords

## Admin Route Protection
 ADMIN_SECRET_KEY
```env
ADMIN_SECRET_KEY=your_super_secret_key_here
```
- Use a long, random string. Keep it secret.

## App URL
 NEXT_PUBLIC_APP_URL
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
- Use `http://localhost:3000` for local development.
- After deploying, change to your production URL (e.g., `https://your-app.vercel.app`).

## Quick checklist
- Create the Postgres DB and set `DATABASE_URL`.
- Get and set `EXCHANGE_RATE_API_KEY`.
- Enable Gmail 2-Step Verification and set SMTP vars with an app password.
- Set a secure `ADMIN_SECRET_KEY`.
- Set `NEXT_PUBLIC_APP_URL` to your app URL.
