# IOF Mock Server

Mock server for the Islamic Open Finance (IOF) Platform API, perfect for development and testing.

[![Docker](https://img.shields.io/docker/v/iof/mock-server?label=docker)](https://hub.docker.com/r/iof/mock-server)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## Features

✅ **Complete API Mocking** - All 29 Rails, 227+ endpoints
✅ **Realistic Data** - Sample contracts, cards, transactions
✅ **Shariah Compliance** - Validates against Shariah rules
✅ **Stateful Mode** - Persist data across requests
✅ **Request Validation** - Validates all requests against OpenAPI spec
✅ **Dynamic Responses** - Parameterized responses based on input
✅ **Webhook Simulation** - Trigger webhook events
✅ **Error Scenarios** - Simulate errors, rate limits, timeouts
✅ **No Dependencies** - Runs standalone via Docker

## Quick Start

### Docker (Recommended)

```bash
# Run mock server
docker run -p 8080:8080 iof/mock-server

# Server is now running at http://localhost:8080
```

### Docker Compose

```yaml
version: "3.8"
services:
  iof-mock:
    image: iof/mock-server:latest
    ports:
      - "8080:8080"
    environment:
      - IOF_MOCK_MODE=stateful
      - IOF_MOCK_SEED_DATA=true
```

### Local Installation

```bash
# Clone repository
git clone https://github.com/Islamic-Open-Finance/iof-mock.git
cd iof-mock

# Install dependencies
npm install

# Start server
npm start
```

## Usage

### Basic Request

```bash
# Create Murabaha contract
curl -X POST http://localhost:8080/api/v1/contracts/murabaha \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-123",
    "asset_description": "Toyota Camry 2024",
    "asset_category": "VEHICLE",
    "cost_price": 50000,
    "profit_amount": 5000,
    "installment_count": 24,
    "currency": "SAR"
  }'
```

### With SDK

```typescript
import { IOFClient } from "@iof/sdk";

const client = new IOFClient({
  apiKey: "test_key",
  baseUrl: "http://localhost:8080",
});

const contract = await client.contracts.createMurabaha({
  customer_id: "CUST-123",
  asset_description: "Toyota Camry 2024",
  asset_category: "VEHICLE",
  cost_price: 50000,
  profit_amount: 5000,
  installment_count: 24,
  currency: "SAR",
});

console.log("Mock contract created:", contract.id);
```

## Modes

### Stateless Mode (Default)

Returns example responses without persisting data:

```bash
docker run -p 8080:8080 -e IOF_MOCK_MODE=stateless iof/mock-server
```

- Fast and lightweight
- No state persistence
- Always returns same example data

### Stateful Mode

Persists data in memory for realistic testing:

```bash
docker run -p 8080:8080 -e IOF_MOCK_MODE=stateful iof/mock-server
```

- In-memory data store
- CRUD operations persist
- Relationships maintained (e.g., contracts → ledger entries)
- Resets on server restart

### Database Mode

Persist data to PostgreSQL for long-running tests:

```bash
docker run -p 8080:8080 \
  -e IOF_MOCK_MODE=database \
  -e IOF_MOCK_DATABASE_URL=postgresql://user:pass@localhost:5432/iof_mock \
  iof/mock-server
```

## Seed Data

Load realistic test data on startup:

```bash
docker run -p 8080:8080 -e IOF_MOCK_SEED_DATA=true iof/mock-server
```

Seed data includes:

- 100 sample customers
- 50 Murabaha contracts (various statuses)
- 30 active cards
- 200 transactions
- 10 Shariah rules

## Scenarios

Simulate specific scenarios by adding headers:

### Error Scenarios

```bash
# Simulate Shariah breach
curl -X POST http://localhost:8080/api/v1/contracts/murabaha \
  -H "X-Mock-Scenario: shariah_breach" \
  -d '{"asset_category": "ALCOHOL", ...}'

# Response: 422 Unprocessable Entity
# {
#   "error": {
#     "code": "SHARIAH_BREACH",
#     "message": "Asset category 'ALCOHOL' is forbidden"
#   }
# }
```

### Rate Limiting

```bash
# Simulate rate limit
curl -X GET http://localhost:8080/api/v1/contracts \
  -H "X-Mock-Scenario: rate_limit"

# Response: 429 Too Many Requests
# X-RateLimit-Limit: 1000
# X-RateLimit-Remaining: 0
# X-RateLimit-Reset: 1735084800
```

### Slow Responses

```bash
# Simulate 5-second delay
curl -X GET http://localhost:8080/api/v1/contracts \
  -H "X-Mock-Delay: 5000"
```

### Timeout

```bash
# Simulate timeout (request never completes)
curl -X GET http://localhost:8080/api/v1/contracts \
  -H "X-Mock-Scenario: timeout"
```

## Webhook Simulation

Trigger webhook events:

```bash
# Subscribe to webhooks
curl -X POST http://localhost:8080/api/v1/webhooks/subscriptions \
  -d '{
    "url": "https://your-app.com/webhooks",
    "events": ["contract.created", "contract.activated"]
  }'

# Create contract (triggers webhook)
curl -X POST http://localhost:8080/api/v1/contracts/murabaha \
  -d '{...}'

# Mock server will POST to https://your-app.com/webhooks:
# {
#   "event_type": "contract.created",
#   "data": {
#     "contract_id": "CNT-789",
#     ...
#   },
#   "timestamp": "2025-12-23T10:30:00Z"
# }
```

## Configuration

Environment variables:

| Variable                     | Default     | Description                            |
| ---------------------------- | ----------- | -------------------------------------- |
| `IOF_MOCK_PORT`              | `8080`      | Server port                            |
| `IOF_MOCK_MODE`              | `stateless` | Mode (stateless, stateful, database)   |
| `IOF_MOCK_SEED_DATA`         | `false`     | Load seed data on startup              |
| `IOF_MOCK_DATABASE_URL`      | -           | PostgreSQL URL (for database mode)     |
| `IOF_MOCK_WEBHOOK_DELIVERY`  | `true`      | Actually deliver webhooks              |
| `IOF_MOCK_WEBHOOK_RETRY`     | `3`         | Webhook retry attempts                 |
| `IOF_MOCK_VALIDATE_REQUESTS` | `true`      | Validate requests against OpenAPI spec |
| `IOF_MOCK_VALIDATE_SHARIAH`  | `true`      | Validate Shariah compliance            |
| `IOF_MOCK_LOG_LEVEL`         | `info`      | Log level (debug, info, warn, error)   |

## Testing Shariah Compliance

The mock server enforces Shariah rules:

```bash
# Forbidden asset category
curl -X POST http://localhost:8080/api/v1/contracts/murabaha \
  -d '{"asset_category": "ALCOHOL", ...}'
# Response: 422 - Shariah breach

# Forbidden MCC (card transaction)
curl -X POST http://localhost:8080/api/v1/cards/authorizations \
  -d '{"mcc": "5921", ...}'  # MCC 5921 = Liquor Stores
# Response: 422 - Shariah breach (forbidden merchant category)
```

## Integration Testing

Example Jest test suite:

```typescript
import { IOFClient } from '@iof/sdk';

describe('IOF Platform Integration', () => {
  let client: IOFClient;

  beforeAll(() => {
    client = new IOFClient({
      apiKey: 'test_key',
      baseUrl: 'http://localhost:8080'
    });
  });

  it('should create Murabaha contract', async () => {
    const contract = await client.contracts.createMurabaha({
      customer_id: 'CUST-123',
      asset_description: 'Toyota Camry 2024',
      asset_category: 'VEHICLE',
      cost_price: 50000,
      profit_amount: 5000,
      installment_count: 24,
      currency: 'SAR'
    });

    expect(contract.id).toMatch(/^CNT-/);
    expect(contract.status).toBe('DRAFT');
  });

  it('should reject Shariah-violating contract', async () => {
    await expect(
      client.contracts.createMurabaha({
        customer_id: 'CUST-123',
        asset_category: 'ALCOHOL',  // Forbidden!
        ...
      })
    ).rejects.toThrow('SHARIAH_BREACH');
  });
});
```

## CI/CD Integration

### GitHub Actions

```yaml
name: API Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      iof-mock:
        image: iof/mock-server:latest
        ports:
          - 8080:8080
        env:
          IOF_MOCK_MODE: stateful
          IOF_MOCK_SEED_DATA: true

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm install

      - name: Run integration tests
        run: npm test
        env:
          IOF_BASE_URL: http://localhost:8080
```

### GitLab CI

```yaml
test:
  image: node:18
  services:
    - name: iof/mock-server:latest
      alias: iof-mock
  variables:
    IOF_BASE_URL: http://iof-mock:8080
  script:
    - npm install
    - npm test
```

## Mock Data Examples

### Contracts

```json
{
  "id": "CNT-001",
  "type": "MURABAHA",
  "customer_id": "CUST-123",
  "asset_description": "Toyota Camry 2024",
  "cost_price": 50000,
  "profit_amount": 5000,
  "status": "ACTIVE"
}
```

### Cards

```json
{
  "id": "CRD-001",
  "masked_pan": "5xxx xxxx xxxx 1234",
  "expiry_date": "12/28",
  "status": "ACTIVE",
  "card_type": "DEBIT"
}
```

### Authorizations

```json
{
  "auth_id": "AUTH-001",
  "amount": 500,
  "merchant": "Electronics Store",
  "mcc": "5732",
  "status": "APPROVED"
}
```

## Request/Response Logging

Enable debug logging to see all requests:

```bash
docker run -p 8080:8080 -e IOF_MOCK_LOG_LEVEL=debug iof/mock-server
```

Output:

```
[DEBUG] POST /api/v1/contracts/murabaha
[DEBUG] Request: {"customer_id": "CUST-123", ...}
[DEBUG] Shariah validation: PASS
[DEBUG] Response: 201 {"id": "CNT-789", ...}
```

## Development

### Build Docker Image

```bash
docker build -t iof/mock-server:latest .
```

### Run Locally

```bash
npm install
npm run dev
```

### Run Tests

```bash
npm test
```

## Limitations

The mock server has some limitations compared to the real API:

- **No Real Ledger**: Ledger operations don't use TigerBeetle
- **No Real Auth**: All tokens/API keys accepted
- **Simplified Shariah**: Basic rule checking only
- **No External Integrations**: Card networks, SWIFT, etc. not called
- **Limited State**: In-memory state lost on restart (unless using database mode)

## Troubleshooting

### Connection Refused

Make sure the server is running:

```bash
curl http://localhost:8080/health
```

### Invalid Responses

Check OpenAPI spec version matches SDK version:

```bash
curl http://localhost:8080/openapi.json | jq '.info.version'
```

### Webhook Not Delivered

Check webhook logs:

```bash
docker logs <container_id> | grep webhook
```

Enable webhook logging:

```bash
docker run -p 8080:8080 -e IOF_MOCK_LOG_LEVEL=debug iof/mock-server
```

## Support

- **Documentation**: https://docs.islamicopenfinance.com/mock-server
- **GitHub Issues**: https://github.com/Islamic-Open-Finance/iof-mock/issues
- **Email**: support@islamicopenfinance.com

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

## Related Projects

- [IOF OpenAPI](https://github.com/Islamic-Open-Finance/iof-openapi) - OpenAPI specification
- [IOF SDKs](https://github.com/Islamic-Open-Finance/iof-sdks) - Client libraries
- [IOF DevTools](https://github.com/Islamic-Open-Finance/iof-devtools) - CLI tools

---

**Built with ❤️ for the Islamic finance community**
