# CRM Backend API

Backend API for CRM with AI Chatbot integration.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your actual values
```

3. Setup database:
```bash
npm run db:generate
npm run db:migrate
```

4. Run development server:
```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Prisma Studio
- `npm test` - Run tests
- `npm run lint` - Lint code

## Project Structure

```
src/
├── config/       - Configuration files
├── controllers/  - Request handlers
├── services/     - Business logic
├── middlewares/  - Express middlewares
├── routes/       - API routes
├── utils/        - Utility functions
└── types/        - TypeScript type definitions
```
