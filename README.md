# @iof/obp-demo-server

Open Banking Protocol (OBP) sandbox demo server for Islamic Open Finance. Provides an in-memory OBP v5.1.0-compatible API for development and testing without requiring an external OBP server.

## Tech Stack

- **Runtime**: Node.js 22 / Bun (dual-runtime support), TypeScript 5.7+
- **Framework**: Hono 4 with @hono/node-server (Node.js) or Bun.serve
- **Storage**: In-memory Maps (no external database required)
- **Validation**: Zod schemas for all write operations
- **Middleware**: CORS, secure headers, body limit, request ID, structured logging

## API Endpoints

All OBP endpoints follow the OBP v5.1.0 specification under `/obp/v5.1.0`.

### Authentication

| Method | Endpoint                       | Description                                |
| ------ | ------------------------------ | ------------------------------------------ |
| `POST` | `/obp/v5.1.0/my/logins/direct` | DirectLogin authentication (returns token) |

### Banks

| Method | Endpoint                    | Description    |
| ------ | --------------------------- | -------------- |
| `GET`  | `/obp/v5.1.0/banks`         | List all banks |
| `GET`  | `/obp/v5.1.0/banks/:bankId` | Get bank by ID |

### Accounts

| Method | Endpoint                                              | Description            |
| ------ | ----------------------------------------------------- | ---------------------- |
| `POST` | `/obp/v5.1.0/banks/:bankId/accounts`                  | Create account         |
| `GET`  | `/obp/v5.1.0/banks/:bankId/accounts`                  | List accounts for bank |
| `GET`  | `/obp/v5.1.0/banks/:bankId/accounts/:accountId`       | Get account by ID      |
| `GET`  | `/obp/v5.1.0/my/accounts`                             | List all user accounts |
| `PUT`  | `/obp/v5.1.0/banks/:bankId/accounts/:accountId/close` | Close account          |

### Transactions

| Method | Endpoint                                                                    | Description        |
| ------ | --------------------------------------------------------------------------- | ------------------ |
| `POST` | `/obp/v5.1.0/banks/:bankId/accounts/:accountId/transactions`                | Create transaction |
| `GET`  | `/obp/v5.1.0/banks/:bankId/accounts/:accountId/transactions`                | List transactions  |
| `GET`  | `/obp/v5.1.0/banks/:bankId/accounts/:accountId/transactions/:transactionId` | Get transaction    |

### Customers

| Method | Endpoint                                                      | Description              |
| ------ | ------------------------------------------------------------- | ------------------------ |
| `POST` | `/obp/v5.1.0/banks/:bankId/customers`                         | Create customer          |
| `GET`  | `/obp/v5.1.0/banks/:bankId/customers`                         | List customers for bank  |
| `GET`  | `/obp/v5.1.0/banks/:bankId/customers/:customerId`             | Get customer by ID       |
| `POST` | `/obp/v5.1.0/banks/:bankId/accounts/:accountId/link-customer` | Link customer to account |

### Products

| Method | Endpoint                                          | Description         |
| ------ | ------------------------------------------------- | ------------------- |
| `GET`  | `/obp/v5.1.0/banks/:bankId/products`              | List bank products  |
| `GET`  | `/obp/v5.1.0/banks/:bankId/products/:productCode` | Get product by code |

### System Endpoints

| Endpoint            | Description                                    |
| ------------------- | ---------------------------------------------- |
| `GET /health`       | Health check with data store stats             |
| `GET /health/ready` | Readiness check (memory + data initialization) |
| `GET /health/live`  | Liveness check                                 |
| `GET /`             | API info and endpoint listing                  |

## Demo Data

The server initializes with seed data on startup:

- **1 demo bank**: "IOF Bank" (id: `iof-bank-001`) with BIC and IBAN routing
- **5 Islamic finance products**: Murabaha Financing, Ijarah Lease, Musharakah Partnership, Sukuk Investment, Takaful Insurance

Additional accounts, transactions, and customers are created through the API at runtime and stored in memory (reset on restart).

## Environment Variables

| Variable                  | Required | Default                                                                      | Description          |
| ------------------------- | -------- | ---------------------------------------------------------------------------- | -------------------- |
| `PORT` or `OBP_MOCK_PORT` | No       | `3005`                                                                       | HTTP port            |
| `CORS_ORIGINS`            | No       | `https://islamicopenfinance.com,http://localhost:3000,http://localhost:3001` | Allowed CORS origins |

## Development Setup

```bash
# From monorepo root
pnpm install

# Start with hot reload
pnpm --filter @iof/obp-demo-server dev

# Or from this directory
pnpm dev
```

No external dependencies required. The server runs entirely in-memory.

## Build Commands

```bash
pnpm build       # Build with tsup (ESM output)
pnpm start       # Start production server
pnpm dev         # Start dev server with hot reload
pnpm test        # Run tests with Vitest
pnpm lint        # Lint with ESLint
pnpm typecheck   # Type check with tsc --noEmit
```

## Architecture

- **In-memory storage**: Maps for banks, accounts, transactions, customers, products, and auth tokens
- **OBP v5.1.0 compatible**: Implements the subset of OBP API used by @iof/obp-gateway
- **Dual-runtime**: Detects Bun at runtime and uses `Bun.serve` if available, falls back to `@hono/node-server`
- **Zod validation**: All write endpoints validate request bodies with Zod schemas
- **Stateless auth**: DirectLogin tokens stored in memory with 1-hour expiry
- **Development/sandbox only**: Not intended for production use

## License

Proprietary. Copyright 2025 Islamic Open Finance™. All rights reserved. See LICENSE in repository root.
