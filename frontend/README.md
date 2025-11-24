# CRM Frontend

Frontend application for CRM with AI Chatbot integration built with Next.js 14.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

3. Run development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Lint code
- `npm run type-check` - Type check without emitting files

## Project Structure

```
app/              - Next.js App Router pages and layouts
components/       - React components
  ├── ui/         - shadcn/ui components
  ├── layout/     - Layout components
  ├── forms/      - Form components
  └── dashboard/  - Dashboard components
lib/              - Utility functions and libraries
types/            - TypeScript type definitions
public/           - Static assets
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Radix UI)
- **Forms**: React Hook Form + Zod
- **State**: Zustand
- **Auth**: NextAuth.js
- **HTTP Client**: Axios
