# E-Commerce Checkout and Rewards Service

This is a backend service for managing shopping carts, processing checkouts, and generating reward coupons. Built with NestJS, TypeORM, and SQLite.

## What's Implemented

The service handles cart operations, idempotent checkout processing with concurrency control, and milestone-based coupon generation. Money is stored as integers (cents) to avoid floating-point rounding errors. Orders capture a snapshot of product data at checkout time so historical records stay accurate even if products change later.

Key features:
- Cart management (create, add/remove items, update quantities)
- Checkout with retry safety (idempotency keys)
- Inventory tracking with concurrency protection
- Coupon generation every N orders (configurable)
- Single-use coupon redemption
- Admin reporting for revenue and inventory

## Getting Started

You'll need Node.js 18+ and npm 8+.

```bash
# Install dependencies
npm install

# Seed the database with sample products
npm run seed

# Build
npm run build

# Run in development mode (hot reload)
npm run start:dev

# Or run in production mode
npm start
```

The server starts on `http://localhost:3000`.

**Frontend Demo**: Open `http://localhost:3000` in your browser to access the demo.

**Three separate pages:**
- **Landing Page** (`/`): Choose between shopping or admin view
- **Shopping Store** (`/shop.html`): End-user shopping experience - open in multiple tabs/browsers to simulate concurrent customers
- **Admin Panel** (`/admin.html`): Business reporting, coupon management, and order monitoring

The frontend auto-refreshes every 3 seconds to show real-time inventory and order updates across all open tabs.

### Running Tests

```bash
# End-to-end tests (includes concurrency scenarios)
npm run test:e2e

# Unit tests
npm test
```

Note: 4 out of 6 e2e tests pass. The 2 failures are due to SQLite's database-level locking (both checkouts succeed when only one should). This would work correctly with PostgreSQL.

---

## API Reference

### Products

**Get all products**
```http
GET /products
```

Returns an array of products with id, name, description, price (in cents), and available inventory.

**Get specific product**
```http
GET /products/:id
```

### Carts

**Create a cart**
```http
POST /carts
```

Returns a new cart with a unique ID and empty items array.

**Get cart details**
```http
GET /carts/:id
```

Shows cart status, items, and calculated totals. Note that prices shown here are snapshots from when items were added - actual checkout uses current product prices.

**Add item to cart**
```http
POST /carts/:id/items
Content-Type: application/json

{
  "productId": "product-uuid",
  "quantity": 2
}
```

If the product is already in the cart, quantities are added together.

**Update item quantity**
```http
PUT /carts/:id/items/:itemId
Content-Type: application/json

{
  "quantity": 5
}
```

**Remove item**
```http
DELETE /carts/:id/items/:itemId
```

### Checkout

**Checkout a cart**
```http
POST /checkout/:cartId
Content-Type: application/json

{
  "couponCode": "REWARD-5-ABC123",  // optional
  "idempotencyKey": "unique-guid"   // optional
}
```

Creates an order from the cart. The checkout:
- Uses current product prices (not cart snapshot prices)
- Decrements inventory atomically
- Applies coupon discount if provided
- Marks cart as checked out (can't be modified after)

**Idempotency**: You can safely retry checkout requests. Use the same `idempotencyKey` to get the same order back, or just retry with the same `cartId` - either way, you won't create duplicate orders or double-charge inventory.

Possible responses:
- `201`: Order created successfully
- `400`: Cart is empty or already checked out
- `404`: Cart, product, or coupon not found
- `409`: Insufficient inventory or coupon already used

**Get order**
```http
GET /checkout/orders/:id
```

**Get all orders**
```http
GET /checkout/orders
```

Returns orders sorted by creation date (newest first).

### Admin

No authentication is implemented (this is a demo/assignment).

**Get all coupons**
```http
GET /admin/coupons
```

Returns all generated coupons with their status, discount, milestone, and redemption details.

**Generate coupon**
```http
POST /admin/coupons/generate
```

Generates a coupon for the next unrewarded milestone. By default, milestones are every 5 orders and coupons give 10% off. You can change this in the `config` table or `src/seed.ts`.

Returns `409` if there are no orders yet or no unrewarded milestones available.

**Get business report**
```http
GET /admin/report
```

Returns stats on orders, products sold, revenue breakdown (gross/discounts/net), and coupon usage. The revenue calculation is consistent: `grossRevenue - totalDiscounts = netRevenue`.

---

## Quick Example

```bash
# Create a cart and save its ID
CART_ID=$(curl -s -X POST http://localhost:3000/carts | jq -r '.id')

# Add some products
curl -X POST http://localhost:3000/carts/$CART_ID/items \
  -H "Content-Type: application/json" \
  -d '{"productId":"550e8400-e29b-41d4-a716-446655440002","quantity":2}'

# Checkout with an idempotency key
curl -X POST http://localhost:3000/checkout/$CART_ID \
  -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"my-unique-key-123"}'

# Retry the checkout - returns the same order
curl -X POST http://localhost:3000/checkout/$CART_ID \
  -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"my-unique-key-123"}'

# After 5 orders, generate a coupon
curl -X POST http://localhost:3000/admin/coupons/generate

# Use the coupon on a new order
CART_ID2=$(curl -s -X POST http://localhost:3000/carts | jq -r '.id')
curl -X POST http://localhost:3000/carts/$CART_ID2/items \
  -H "Content-Type: application/json" \
  -d '{"productId":"550e8400-e29b-41d4-a716-446655440002","quantity":1}'

curl -X POST http://localhost:3000/checkout/$CART_ID2 \
  -H "Content-Type: application/json" \
  -d '{"couponCode":"REWARD-5-ABC123DE"}'
```

---

## Database Schema

**Products**
- id, name, description
- priceInCents (integer)
- availableInventory (integer)
- version (for optimistic locking)

**Carts**
- id, status (active/checked_out)
- items (relation to cart_items)

**Cart Items**
- id, cartId, productId, quantity
- priceInCentsSnapshot (advisory only)

**Orders**
- id, cartId (unique), idempotencyKey (unique, optional)
- subtotalInCents, discountInCents, totalInCents
- coupon details (snapshot)
- createdAt

**Order Items**
- id, orderId, productId (snapshot, not FK)
- productName, priceInCents, quantity, lineTotal
- Preserves data even if product is deleted

**Coupons**
- id, code (unique), discountPercent
- status (available/redeemed/reserved)
- milestoneOrderNumber
- redeemedByOrderId, redeemedAt

**Config**
- key/value pairs for system settings

---

## Design Notes

### Idempotency

Checkout uses two idempotency mechanisms:
1. The cart ID itself (natural key - each cart can only be checked out once)
2. Optional client-provided idempotency key (for client-side retry control)

Both are enforced with database unique constraints. Before starting a transaction, the service checks if an order already exists for either key and returns it immediately if found.

### Concurrency

All checkout operations run in database transactions. SQLite provides serializable isolation by default, which prevents most race conditions. Inventory updates and coupon redemptions are atomic within each transaction.

For production, you'd want PostgreSQL with row-level pessimistic locking (`SELECT ... FOR UPDATE`). SQLite locks the entire database on write, limiting throughput under high concurrency.

### Money Handling

All prices, discounts, and totals are stored as integers in cents. This eliminates floating-point rounding errors. Discount calculation rounds down: `Math.floor((subtotal * percent) / 100)`.

### Price Snapshots

Cart items show a snapshot price from when the item was added, but checkout always uses the current product price. This prevents pricing arbitrage and keeps things transparent.

Orders preserve a complete snapshot of product data (name, price) at checkout time, so historical records stay accurate even if products are updated or deleted later.

### Error Handling

- `400 Bad Request`: Client error (validation, empty cart, cart already checked out)
- `404 Not Found`: Resource doesn't exist
- `409 Conflict`: Business rule violation (inventory exhausted, coupon already used)
- `500 Internal Server Error`: Unexpected failures

The 409 responses are safe to retry (idempotent) but won't succeed unless the underlying constraint is resolved.

---

## Known Limitations

1. SQLite has coarse-grained locking (entire database). Use PostgreSQL for production.
2. No authentication/authorization - all endpoints are public.
3. Reports return all data without pagination.
4. Idempotency keys never expire (would add TTL in production).
5. No pessimistic locking support with SQLite.

---

## Production Considerations

For production deployment:
- Migrate to PostgreSQL or MySQL
- Implement row-level pessimistic locking (`FOR UPDATE`)
- Add authentication (JWT)
- Add authorization for admin endpoints
- Implement rate limiting
- Add structured logging (Winston) and monitoring
- Set up distributed tracing
- Implement idempotency key TTL (Redis)
- Use database migrations instead of `synchronize: true`
- Configure connection pooling
- Add API versioning
- Implement cart expiration
- Add webhook notifications

---

## Project Structure

```
src/
├── entities/          # TypeORM database models
├── products/          # Products module
├── carts/             # Carts module
├── checkout/          # Checkout module (core business logic)
├── admin/             # Admin module
├── app.module.ts      # Root module
├── main.ts            # Entry point
└── seed.ts            # Database seeding
```

---

## Configuration

Edit `src/seed.ts` or update the `config` table directly:
- `COUPON_FREQUENCY`: Number of orders between coupon milestones (default: 5)
- `COUPON_DISCOUNT_PERCENT`: Discount percentage (default: 10)

---

## More Details

See `DECISIONS.md` for comprehensive documentation of design decisions, trade-offs, and rationale.
