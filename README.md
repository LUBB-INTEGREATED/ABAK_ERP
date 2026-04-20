# ABAK ERP System

Complete ERP system for engineering consultancy firms.

## 🎯 Project Overview

**Phase 1**: Core 4 Modules (Lead Capture, CRM, Sales Pipeline, Quotation Engine)
**Timeline**: 70 days (10 weeks)
**Status**: 🚧 In Development

## 🎨 Brand Design

**ABAK Engineering Consultancy** - أبـــاك للاستشـــارات الهندســية

### Brand Colors
- **Primary**: ABAK Blue `#236382` - Trust, professionalism, engineering expertise
- **Secondary**: ABAK Gold `#A78B42` - Quality, premium service, excellence
- **Accent**: Dark Text `#1B1B1B`, Off White `#F9F7F5`

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for complete design guidelines.

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
- **Monorepo**: Nx (TypeScript-solution workspace)
- **Package Manager**: pnpm
- **CI/CD**: GitHub Actions
- **Code Quality**: ESLint (flat config), Prettier, Husky

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

# Build every project (useful for first-run sanity check)
pnpm build

# Set up environment variables (once .env.example exists in issue #004)
cp .env.example .env.local

# Once the apps are scaffolded:
pnpm nx serve web    # Next.js frontend (issue #002)
pnpm nx serve api    # Nest.js backend  (issue #003)
```

### Development

```bash
# Build every project in dependency order
pnpm build

# Lint every project (including module-boundary enforcement)
pnpm lint

# Run every project's tests
pnpm test

# Typecheck without emitting
pnpm typecheck

# Only run targets for projects affected by your changes vs. main
pnpm affected:build
pnpm affected:lint
pnpm affected:test

# Visualize the project dependency graph in your browser
pnpm graph

# Work on a single project
pnpm nx build shared-types
pnpm nx lint  shared-ui
pnpm nx serve web       # once the Next.js app is scaffolded (issue #002)
pnpm nx serve api       # once the Nest.js app is scaffolded (issue #003)
```

## 📁 Project Structure

```
abak-erp/
├── packages/
│   ├── shared/
│   │   ├── types/          # Cross-module TypeScript types
│   │   ├── utils/          # Cross-module utilities
│   │   └── ui/             # Cross-module UI primitives
│   ├── lead-capture/       # Module 1 libs (added in Sprint 1)
│   ├── crm/                # Module 2 libs (added in Sprint 2)
│   ├── sales-pipeline/     # Module 3 libs (added in Sprint 3)
│   ├── quotation/          # Module 4 libs (added in Sprint 4)
│   ├── marketing/          # Module 5 libs
│   ├── accounting/         # Future module
│   ├── hr/                 # Future module
│   ├── web/                # Next.js frontend (scaffolded in issue #002)
│   └── api/                # Nest.js backend  (scaffolded in issue #003)
├── prisma/                 # Database schema & migrations (issue #004)
├── nx.json                 # Nx workspace config (targets, plugins, cache)
├── tsconfig.base.json      # Shared compiler options + path aliases
├── pnpm-workspace.yaml
└── package.json            # Workspace root
```

### Module boundaries (the reason we picked Nx)

Every project is tagged with **scope** and **type**. ESLint (`@nx/enforce-module-boundaries`) blocks forbidden imports at lint time:

| Tag                       | Who can depend on it                                         |
| ------------------------- | ------------------------------------------------------------ |
| `scope:shared`            | everyone                                                     |
| `scope:<module>`          | only code in the same module + `scope:shared`                |
| `scope:web` / `scope:api` | everyone (apps compose modules)                              |
| `type:feature`            | → `feature`, `ui`, `data-access`, `util`, `types`            |
| `type:ui`                 | → `ui`, `util`, `types` (no data-access: keep UI presentational) |
| `type:data-access`        | → `data-access`, `util`, `types`                             |
| `type:util`               | → `util`, `types`                                            |
| `type:types`              | → `types` only (leaf of the graph)                           |

Run `pnpm lint` and the rule will catch, e.g., `accounting-feature` trying to import from `hr-internal`.

### Adding a new library or app

Don't create directories by hand — use the Nx generators so tags, `tsconfig` references, and lint configs are consistent:

```bash
# A shared library
pnpm nx g @nx/js:lib packages/shared/<name> \
  --name=shared-<name> --bundler=tsc --linter=eslint \
  --tags=scope:shared,type:<util|ui|types|data-access>

# A module-scoped library (e.g. CRM feature)
pnpm nx g @nx/js:lib packages/crm/<name> \
  --name=crm-<name> --bundler=tsc --linter=eslint \
  --tags=scope:crm,type:<feature|ui|data-access|util|types>

# A Next.js app (issue #002 will do this)
pnpm nx g @nx/next:app packages/web --tags=scope:web

# A Nest.js app (issue #003 will do this)
pnpm nx g @nx/nest:app packages/api --tags=scope:api
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full checklist.

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

- [Project Plan](../PROJECT_PLAN.md)
- [GitHub Issues](../GitHub%20Issues/)
- [Design System](./DESIGN_SYSTEM.md) - Brand colors, typography, components
- [Design Setup Guide](./SETUP_DESIGN.md) - How to implement ABAK branding
- [API Documentation](http://localhost:3001/api/docs) (when running)
- [Module Specifications](../Modules%20Process%20Docs/)

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

- [ ] Sprint 0: Infrastructure Setup (Week 1-2) - 🎯 **Current Sprint**
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
