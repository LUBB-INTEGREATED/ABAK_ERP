# ABAK ERP System

Complete ERP system for engineering consultancy firms.

## 🎯 Project Overview

**Phase 1**: Core 4 Modules (Lead Capture, CRM, Sales Pipeline, Quotation Engine)
**Timeline**: 70 days (10 weeks)
**Status**: 🚧 In Development

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand + React Query
- **PWA**: next-pwa

### Backend
- **Framework**: Nest.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: Custom JWT (Passport.js + bcrypt)
- **API Docs**: Swagger/OpenAPI

### Infrastructure
- **Monorepo**: Turborepo
- **Package Manager**: pnpm
- **CI/CD**: GitHub Actions
- **Code Quality**: ESLint, Prettier, Husky

## 📋 Modules

### Module 1: Lead Capture & Reception
- Multi-channel lead capture (6 channels)
- Automatic client detection
- SLA tracking and alerts
- Service catalog integration

### Module 2: CRM - Client Relationship Management
- Client 360° view
- 10 interaction types
- Follow-up management
- Document management

### Module 3: Sales Pipeline & Team Management
- 8-stage pipeline (Kanban view)
- RFQ management
- Field visit tracking
- Team performance dashboard

### Module 4: Quotation & Pricing Engine
- Flexible quote builder
- Multi-level approval workflow
- Quote versioning
- PDF generation
- Automatic PO generation

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 15+

### Installation

```bash
# Clone the repository
git clone https://github.com/LUBB-INTEGREATED/ABAK_ERP.git
cd ABAK_ERP

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run database migrations
pnpm prisma:migrate

# Seed the database
pnpm prisma:seed

# Start development servers
pnpm dev
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Run frontend only
pnpm dev --filter @abak-erp/web

# Run backend only
pnpm dev --filter @abak-erp/api

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build
```

## 📁 Project Structure

```
abak-erp/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Nest.js backend
├── packages/
│   ├── ui/           # Shared UI components
│   ├── types/        # Shared TypeScript types
│   ├── utils/        # Shared utilities
│   └── config/       # Shared configurations
├── prisma/           # Database schema & migrations
├── GitHub Issues/    # Project planning & issues
└── turbo.json        # Turborepo configuration
```

## 🔐 Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/abak_erp"

# JWT Authentication
JWT_SECRET="your-super-secret-key-min-32-characters"

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"
PORT=3001

# Frontend Configuration
FRONTEND_URL="http://localhost:3000"
```

## 📚 Documentation

- [Project Plan](../Abak/PROJECT_PLAN.md)
- [GitHub Issues](../Abak/GitHub%20Issues/)
- [API Documentation](http://localhost:3001/api/docs) (when running)
- [Module Specifications](../Abak/Modules%20Process%20Docs/)

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/M1-001-description`
2. Make your changes
3. Run tests: `pnpm test`
4. Commit using conventional commits: `git commit -m "feat(module-1): add feature"`
5. Push to the branch: `git push origin feature/M1-001-description`
6. Create a Pull Request

### Commit Convention

- `feat(module-1):` - New feature
- `fix(module-2):` - Bug fix
- `refactor(api):` - Code refactoring
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `chore:` - Build process or auxiliary tool changes

## 📊 Project Status

- [x] Sprint 0: Infrastructure Setup (Week 1-2)
- [ ] Sprint 1: Module 1 - Lead Capture (Week 3-4)
- [ ] Sprint 2: Module 2 - CRM (Week 5-6)
- [ ] Sprint 3: Module 3 - Sales Pipeline (Week 7-8)
- [ ] Sprint 4: Module 4 - Quotation Engine (Week 9-10)

## 📝 License

Proprietary - LUBB Integrated © 2026

## 👥 Team

**Organization**: LUBB Integrated
**Project**: ABAK ERP System
**Phase**: 1 (Core Modules)

---

🚀 Built with Next.js, Nest.js, and Prisma
