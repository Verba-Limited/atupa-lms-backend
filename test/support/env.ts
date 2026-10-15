// Loaded by Jest before any test module (AppModule validates env on import).
Object.assign(process.env, {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef',
  JWT_EXPIRES_IN: '15m',
  SUPER_ADMIN_EMAIL: 'admin@atupa.test',
  SUPER_ADMIN_PASSWORD: 'AdminPass123',
  SEED_DEMO_CONTENT: 'true',
  LEARNING_REMINDERS_ENABLED: 'false',
  MEDIA_UPLOAD_DIR: 'tmp-test-uploads',
  FRONTEND_URL: 'https://app.atupa.test',
});
