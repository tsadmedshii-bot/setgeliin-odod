import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import type { TestScoring } from '../../shared/src/types';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 60 }).notNull(),
  username: varchar('username', { length: 30 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 10 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('users_username_unique').on(t.username)]);

export const sessions = pgTable('sessions', {
  token: varchar('token', { length: 200 }).primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const tests = pgTable('tests', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  category: varchar('category', { length: 100 }).notNull().default('Ерөнхий'),
  priceMnt: integer('price_mnt').notNull().default(6500),
  published: boolean('published').notNull().default(true),
  scoring: jsonb('scoring').$type<TestScoring>().notNull(),
  sourceFileName: text('source_file_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const purchases = pgTable('purchases', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  testId: integer('test_id').notNull().references(() => tests.id),
  amountMnt: integer('amount_mnt').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  qpayInvoiceId: text('qpay_invoice_id'),
  qpayQrText: text('qpay_qr_text'),
  qpayQrImage: text('qpay_qr_image'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('purchases_user_test_unique').on(t.userId, t.testId)]);

export const attempts = pgTable('attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  testId: integer('test_id').notNull().references(() => tests.id),
  answers: jsonb('answers').$type<number[]>().notNull(),
  score: integer('score').notNull(),
  maxScore: integer('max_score').notNull(),
  resultTitle: text('result_title').notNull(),
  resultDescription: text('result_description').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** QPay тохиргоо — ганцхан мөр (id = 1). Env хувьсагч байвал түүнийг давуу үзнэ. */
export const qpaySettings = pgTable('qpay_settings', {
  id: integer('id').primaryKey(),
  clientId: text('client_id').notNull().default(''),
  clientSecret: text('client_secret').notNull().default(''),
  invoiceCode: text('invoice_code').notNull().default(''),
  merchantId: text('merchant_id').notNull().default(''),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
