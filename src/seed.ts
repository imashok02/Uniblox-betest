import { DataSource } from 'typeorm';
import { Product } from './entities/product.entity';
import { Config } from './entities/config.entity';

const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: 'ecommerce.db',
  entities: [__dirname + '/entities/*.entity{.ts,.js}'],
  synchronize: true,
});

async function seed() {
  await AppDataSource.initialize();

  const productRepository = AppDataSource.getRepository(Product);
  const configRepository = AppDataSource.getRepository(Config);

  // Clear existing data
  await productRepository.clear();
  await configRepository.clear();

  // Seed products
  const products = [
    {
      name: 'Laptop Pro 15"',
      description: 'High-performance laptop with 16GB RAM and 512GB SSD',
      priceInCents: 129999, // $1,299.99
      availableInventory: 10,
    },
    {
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with precision tracking',
      priceInCents: 2999, // $29.99
      availableInventory: 50,
    },
    {
      name: 'Mechanical Keyboard',
      description: 'RGB mechanical keyboard with Cherry MX switches',
      priceInCents: 8999, // $89.99
      availableInventory: 25,
    },
    {
      name: 'USB-C Hub',
      description: '7-in-1 USB-C hub with HDMI, USB 3.0, and SD card reader',
      priceInCents: 4999, // $49.99
      availableInventory: 3, // Limited inventory
    },
    {
      name: '27" Monitor',
      description: '4K IPS monitor with 99% sRGB color gamut',
      priceInCents: 34999, // $349.99
      availableInventory: 15,
    },
    {
      name: 'Webcam HD',
      description: '1080p webcam with built-in microphone',
      priceInCents: 5999, // $59.99
      availableInventory: 2, // Limited inventory
    },
  ];

  await productRepository.save(products);

  // Seed configuration
  await configRepository.save([
    { key: 'COUPON_FREQUENCY', value: '5' }, // Every 5 orders
    { key: 'COUPON_DISCOUNT_PERCENT', value: '10' }, // 10% discount
  ]);

  console.log('✅ Seed data created successfully');
  console.log(`📦 Created ${products.length} products`);
  console.log('⚙️  Configured coupon system: Every 5 orders = 10% discount coupon');

  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('❌ Error seeding database:', error);
  process.exit(1);
});
