import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Concurrency and Idempotency Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let productWithLimitedInventory: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Seed test data
    await dataSource.query('DELETE FROM products');
    await dataSource.query('DELETE FROM carts');
    await dataSource.query('DELETE FROM orders');
    await dataSource.query('DELETE FROM coupons');
    await dataSource.query('DELETE FROM config');

    // Use UUID v4 format for product IDs
    const limitedProductId = '550e8400-e29b-41d4-a716-446655440001';
    const regularProduct1Id = '550e8400-e29b-41d4-a716-446655440002';
    const regularProduct2Id = '550e8400-e29b-41d4-a716-446655440003';

    // Create a product with limited inventory
    await dataSource.query(`
      INSERT INTO products (id, name, description, priceInCents, availableInventory, version)
      VALUES ('${limitedProductId}', 'Limited Item', 'Only 3 available', 5000, 3, 1)
    `);
    productWithLimitedInventory = { id: limitedProductId };

    // Create regular products
    await dataSource.query(`
      INSERT INTO products (id, name, description, priceInCents, availableInventory, version)
      VALUES
        ('${regularProduct1Id}', 'Regular Item', 'Plenty in stock', 1000, 100, 1),
        ('${regularProduct2Id}', 'Another Item', 'Also in stock', 2000, 50, 1)
    `);

    // Set up coupon config
    await dataSource.query(`
      INSERT INTO config (key, value)
      VALUES ('COUPON_FREQUENCY', '5'), ('COUPON_DISCOUNT_PERCENT', '10')
    `);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Concurrent Checkout - Inventory Overselling Prevention', () => {
    it('should prevent overselling when multiple customers checkout concurrently', async () => {
      // Create 3 carts, each wanting 2 units of the limited item (only 3 available)
      const cart1 = await request(app.getHttpServer())
        .post('/carts')
        .expect(201);

      const addItemResponse = await request(app.getHttpServer())
        .post(`/carts/${cart1.body.id}/items`)
        .send({ productId: productWithLimitedInventory.id, quantity: 2 });

      if (addItemResponse.status !== 201) {
        console.log('Add item failed:', addItemResponse.body);
      }
      expect(addItemResponse.status).toBe(201);

      const cart2 = await request(app.getHttpServer())
        .post('/carts')
        .expect(201);
      await request(app.getHttpServer())
        .post(`/carts/${cart2.body.id}/items`)
        .send({ productId: productWithLimitedInventory.id, quantity: 2 })
        .expect(201);

      const cart3 = await request(app.getHttpServer())
        .post('/carts')
        .expect(201);
      await request(app.getHttpServer())
        .post(`/carts/${cart3.body.id}/items`)
        .send({ productId: productWithLimitedInventory.id, quantity: 2 })
        .expect(201);

      // Attempt to checkout all 3 carts concurrently
      const checkoutPromises = [
        request(app.getHttpServer()).post(`/checkout/${cart1.body.id}`).send({}),
        request(app.getHttpServer()).post(`/checkout/${cart2.body.id}`).send({}),
        request(app.getHttpServer()).post(`/checkout/${cart3.body.id}`).send({}),
      ];

      const results = await Promise.allSettled(checkoutPromises);

      // Count successes and failures
      const successes = results.filter((r) => r.status === 'fulfilled' && (r.value as any).status === 201);
      const failures = results.filter(
        (r) => r.status === 'fulfilled' && (r.value as any).status === 409,
      );

      // Only 1 checkout should succeed (first one to acquire lock)
      // The other 2 should fail with insufficient inventory
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(2);

      // Verify final inventory
      const product = await dataSource.query(
        'SELECT availableInventory FROM products WHERE id = ?',
        [productWithLimitedInventory.id],
      );
      expect(product[0].availableInventory).toBe(1); // 3 - 2 = 1
    });
  });

  describe('Idempotent Checkout', () => {
    it('should return the same order when checkout is retried with idempotency key', async () => {
      const cart = await request(app.getHttpServer())
        .post('/carts')
        .expect(201);

      await request(app.getHttpServer())
        .post(`/carts/${cart.body.id}/items`)
        .send({ productId: '550e8400-e29b-41d4-a716-446655440002', quantity: 1 })
        .expect(201);

      const idempotencyKey = 'unique-key-12345';

      // First checkout
      const response1 = await request(app.getHttpServer())
        .post(`/checkout/${cart.body.id}`)
        .send({ idempotencyKey })
        .expect(201);

      // Retry with same idempotency key
      const response2 = await request(app.getHttpServer())
        .post(`/checkout/${cart.body.id}`)
        .send({ idempotencyKey })
        .expect(201);

      // Should return the exact same order
      expect(response1.body.id).toBe(response2.body.id);
      expect(response1.body.totalInCents).toBe(response2.body.totalInCents);

      // Verify only one order was created
      const orders = await dataSource.query(
        'SELECT * FROM orders WHERE idempotencyKey = ?',
        [idempotencyKey],
      );
      expect(orders.length).toBe(1);
    });

    it('should prevent double checkout of the same cart', async () => {
      const cart = await request(app.getHttpServer())
        .post('/carts')
        .expect(201);

      await request(app.getHttpServer())
        .post(`/carts/${cart.body.id}/items`)
        .send({ productId: '550e8400-e29b-41d4-a716-446655440002', quantity: 1 })
        .expect(201);

      // First checkout
      const response1 = await request(app.getHttpServer())
        .post(`/checkout/${cart.body.id}`)
        .send({})
        .expect(201);

      // Attempt second checkout of same cart (without idempotency key)
      const response2 = await request(app.getHttpServer())
        .post(`/checkout/${cart.body.id}`)
        .send({})
        .expect(201);

      // Should return the same order
      expect(response1.body.id).toBe(response2.body.id);
    });
  });

  describe('Concurrent Coupon Redemption', () => {
    it('should prevent double redemption of the same coupon', async () => {
      // Create 5 orders to trigger coupon generation
      for (let i = 0; i < 5; i++) {
        const cart = await request(app.getHttpServer())
          .post('/carts')
          .expect(201);

        await request(app.getHttpServer())
          .post(`/carts/${cart.body.id}/items`)
          .send({ productId: '550e8400-e29b-41d4-a716-446655440002', quantity: 1 })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/checkout/${cart.body.id}`)
          .send({})
          .expect(201);
      }

      // Generate coupon
      const couponResponse = await request(app.getHttpServer())
        .post('/admin/coupons/generate')
        .expect(201);

      const couponCode = couponResponse.body.code;

      // Create 2 carts trying to use the same coupon
      const cart1 = await request(app.getHttpServer())
        .post('/carts')
        .expect(201);
      await request(app.getHttpServer())
        .post(`/carts/${cart1.body.id}/items`)
        .send({ productId: '550e8400-e29b-41d4-a716-446655440003', quantity: 1 })
        .expect(201);

      const cart2 = await request(app.getHttpServer())
        .post('/carts')
        .expect(201);
      await request(app.getHttpServer())
        .post(`/carts/${cart2.body.id}/items`)
        .send({ productId: '550e8400-e29b-41d4-a716-446655440003', quantity: 1 })
        .expect(201);

      // Try to use the same coupon concurrently
      const checkoutPromises = [
        request(app.getHttpServer())
          .post(`/checkout/${cart1.body.id}`)
          .send({ couponCode }),
        request(app.getHttpServer())
          .post(`/checkout/${cart2.body.id}`)
          .send({ couponCode }),
      ];

      const results = await Promise.allSettled(checkoutPromises);

      const successes = results.filter(
        (r) => r.status === 'fulfilled' && (r.value as any).status === 201,
      );
      const failures = results.filter(
        (r) => r.status === 'fulfilled' && (r.value as any).status === 409,
      );

      // Only one should succeed
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Verify coupon is marked as redeemed
      const coupon = await dataSource.query(
        'SELECT status FROM coupons WHERE code = ?',
        [couponCode],
      );
      expect(coupon[0].status).toBe('redeemed');
    });
  });

  describe('Reporting Consistency', () => {
    it('should provide consistent report data', async () => {
      const report1 = await request(app.getHttpServer())
        .get('/admin/report')
        .expect(200);

      const report2 = await request(app.getHttpServer())
        .get('/admin/report')
        .expect(200);

      // Reports should be identical (idempotent read operation)
      expect(report1.body).toEqual(report2.body);

      // Revenue should reconcile
      expect(report1.body.revenue.grossRevenueInCents - report1.body.revenue.totalDiscountsInCents)
        .toBe(report1.body.revenue.netRevenueInCents);
    });
  });
});
