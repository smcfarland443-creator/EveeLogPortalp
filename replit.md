# Eveelog Portal

## Overview

Eveelog Portal is a vehicle transportation platform built for managing vehicle delivery orders and auctions. The system provides role-based access with separate dashboards for administrators and drivers. Administrators can create and manage orders and auctions, while drivers can view available opportunities and purchase instant-buy auctions.

The application is built as a full-stack TypeScript solution with a React frontend and Express.js backend, featuring modern UI components, real-time data management, and secure authentication through Replit's OAuth system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/UI components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom color schemes and theming support
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation schemas

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API structure with role-based route protection
- **Session Management**: Express sessions with PostgreSQL storage
- **Error Handling**: Centralized error middleware with proper HTTP status codes

### Database & ORM
- **Database**: PostgreSQL with connection pooling via Neon serverless
- **ORM**: Drizzle ORM with TypeScript-first schema definitions
- **Schema Management**: Shared schema between frontend and backend located in `/shared/schema.ts`
- **Migrations**: Drizzle Kit for database schema migrations

### Authentication System
- **Provider**: Replit OAuth integration with OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Role-Based Access**: Admin and driver roles with different permission levels
- **User Management**: Admin-controlled user approval workflow

### Data Models
The system manages three core entities:
- **Users**: Role-based (admin/driver) with status management (pending/active/inactive)
- **Orders**: Vehicle transport jobs with assignment capabilities and status tracking
- **Auctions**: Instant-purchase opportunities for drivers with geographic and vehicle details

### Development Workflow
- **Development Server**: Concurrent frontend (Vite) and backend (tsx) development
- **Build Process**: Separate frontend (Vite) and backend (esbuild) build steps
- **Type Safety**: Shared TypeScript interfaces and Zod schemas ensure type consistency

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless database with connection pooling
- **Authentication**: Replit OAuth system for secure user authentication
- **Session Storage**: PostgreSQL-backed sessions for persistent login state

### UI Components & Styling
- **Radix UI**: Accessible, unstyled component primitives for complex UI elements
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Consistent icon library
- **FontAwesome**: Additional icon resources

### Development Tools
- **Replit Integration**: Development environment optimizations and error overlay
- **Cartographer**: Replit-specific development tooling for enhanced debugging

### Form & Validation
- **Zod**: Runtime type validation and schema definition
- **React Hook Form**: Performant form handling with minimal re-renders

The architecture emphasizes type safety through shared schemas, role-based security, and a clean separation between frontend presentation and backend business logic.