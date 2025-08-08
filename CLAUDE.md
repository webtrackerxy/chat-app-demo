# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-featured real-time chat application with end-to-end encryption, built with React Native (Expo) frontend and Express.js backend using WebSocket technology. The app features advanced multi-mode encryption (PFS, Post-Quantum, Multi-Device), multimedia file sharing, and comprehensive messaging features.

## Project Structure

- `/chat-frontend/` - React Native (Expo) frontend with TypeScript
- `/chat-backend/` - Express.js backend with Socket.IO and Prisma ORM
- `/chat-types/` - Shared TypeScript types between frontend and backend

## Development Commands

### Backend (chat-backend/)
```bash
npm start                    # Start production server
npm run dev                  # Start development server with nodemon
npm test                     # Run all tests
npm run test:encryption      # Run encryption-specific tests
npm run test:encryption-api  # Run encryption API tests
npm run lint                 # Run ESLint
npm run lint:fix             # Fix ESLint issues
npm run prettier-write       # Format code with Prettier
npm run check                # Run all quality checks (lint, prettier, circular deps)
npx prisma db push           # Apply schema changes to database
npx prisma generate          # Generate Prisma client
```

### Frontend (chat-frontend/)
```bash
npx expo start --localhost   # Start Expo development server
npm run android              # Run on Android
npm run ios                  # Run on iOS
npm run web                  # Run on web
npm test                     # Run all tests
npm run test:encryption      # Run encryption-specific tests
npm run typecheck            # TypeScript type checking
npm run lint                 # Run ESLint
npm run lint:fix             # Fix ESLint issues
npm run prettier-write       # Format code with Prettier
npm run check                # Run all quality checks (typecheck, lint, prettier, circular deps)
```

### Database Setup
```bash
cd chat-backend
npx prisma db push    # Create SQLite database and tables
npx prisma generate   # Generate Prisma client
```

## Architecture

### Backend Architecture
- **Express.js** server with Socket.IO for real-time communication
- **Prisma ORM** with SQLite database for persistence
- **Multer** for file upload handling
- **Advanced encryption services** in `/src/services/`
- **Database service layer** in `/src/database/`
- **Route handlers** in `/routes/`

### Frontend Architecture
- **React Native (Expo)** with TypeScript and NativeWind for styling
- **Zustand** for state management
- **Custom hooks** in `/src/hooks/` for real-time features
- **Service layer** in `/src/services/` for API and encryption
- **Comprehensive crypto services** in `/src/services/cryptoService/`
- **Component library** in `/src/components/`

### Key Services
- **AdaptiveEncryptionService** - Multi-mode encryption coordination
- **DoubleRatchetService** - Perfect Forward Secrecy implementation
- **KyberService & DilithiumService** - Post-quantum cryptography
- **DeviceIdentityService** - Multi-device key synchronization
- **DatabaseService** - Centralized database operations

## Encryption System

The app features a sophisticated multi-mode encryption system:

### Encryption Modes
- **PFS (Perfect Forward Secrecy)** - Signal Protocol Double Ratchet with X25519 + ChaCha20-Poly1305
- **PQC (Post-Quantum Cryptography)** - NIST-standardized Kyber-768 + Dilithium-3
- **Multi-Device** - Cross-device key synchronization and management

### Key Features
- **Always-On Encryption** - Automatic initialization for all users
- **Conversation-Based Keys** - Deterministic encryption allowing multi-user decryption
- **Auto-Recipient Setup** - Recipients automatically get keys when receiving messages
- **Hardware-Backed Security** - Device Keychain/Keystore integration

## Database Schema

Uses Prisma ORM with comprehensive models:
- **User** - User accounts with encryption keys
- **Conversation** - Group and direct conversations
- **Message** - Messages with encryption metadata
- **ConversationRatchetState** - Perfect Forward Secrecy state
- **PostQuantumKey** - Post-quantum cryptographic keys
- **DeviceIdentity** - Multi-device support

## Testing

### Test Structure
- Backend tests in `chat-backend/__tests__/`
- Frontend tests in `chat-frontend/src/__tests__/`
- Comprehensive encryption tests with 330+ test cases
- Component tests using React Testing Library
- Integration tests for API endpoints

### Running Tests
```bash
# Backend
cd chat-backend && npm test

# Frontend  
cd chat-frontend && npm test

# Specific test suites
npm run test:encryption      # Encryption-specific tests
npm run test:coverage        # With coverage report
```

## Code Quality

Both frontend and backend include comprehensive tooling:
- **ESLint** with strict TypeScript rules
- **Prettier** for consistent formatting  
- **TypeScript** strict mode with path mappings
- **Circular dependency** detection
- **Pre-commit hooks** for quality enforcement

### Path Mappings (Frontend)
- `@components` → `src/components`
- `@hooks` → `src/hooks`
- `@services` → `src/services`
- `@store` → `src/store`
- `@chat-types` → `../chat-types/src`

## Environment Configuration

### Backend (.env)
```
PORT=3000
DATABASE_URL=file:./dev.db
MAX_FILE_SIZE=10485760
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:3000
REACT_APP_SOCKET_URL=http://localhost:3000
REACT_APP_DEBUG_ENCRYPTION=true
```

## Key Development Practices

1. **Always run quality checks** before committing: `npm run check`
2. **Use TypeScript strict mode** - maintain type safety
3. **Follow encryption patterns** - use AdaptiveEncryptionService for encryption operations
4. **Test encryption thoroughly** - run encryption-specific test suites
5. **Database migrations** - use Prisma schema changes with `npx prisma db push`
6. **Real-time features** - leverage existing Socket.IO infrastructure
7. **Component patterns** - follow existing patterns in `/src/components/`
8. **Service layer** - use existing services for API calls and encryption