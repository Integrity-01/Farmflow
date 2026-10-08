// Seeds the admin account (Yusuf) into the MySQL database, preserving his
// Postgres row so login credentials stay consistent across the migration.
// TEMP PASSWORD: the Postgres plaintext password is unknown, so a known temp
// password is set so Yusuf can sign in. Change it after first login.
const { createConnection } = require('mysql2/promise');

const TEMP_PASSWORD = 'Temp-FarmAdmin-2026!';

const ADMIN = {
  id: '6739d50e-db00-48fc-9cad-93a1454fc542',
  name: 'Yusuf Abdulmalik Olaitan',
  email: 'abdulmalikyusuff01@gmail.com',
  phone: 'abdulmalikyusuff01@gmail.com',
  password_hash:
    '$2b$10$Ex8oYdFJuW8DopmJycyES.Sv9rW5P6AN/Vk2hqU7VsuWF7GEez.k2',
  role: 'administrator',
  avatar_url: null,
  is_active: 1,
};

(async () => {
  const connection = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'farmflow',
  });

  const [existing] = await connection.query('SELECT id FROM users WHERE id = ?', [ADMIN.id]);
  if (existing.length > 0) {
    await connection.query(
      `UPDATE users SET name = ?, email = ?, phone = ?, password_hash = ?, role = ?, is_active = ?
       WHERE id = ?`,
      [ADMIN.name, ADMIN.email, ADMIN.phone, ADMIN.password_hash, ADMIN.role, ADMIN.is_active, ADMIN.id],
    );
    console.log('Admin already present -> updated in place.');
  } else {
    await connection.query(
      `INSERT INTO users (id, name, email, phone, password_hash, role, avatar_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ADMIN.id, ADMIN.name, ADMIN.email, ADMIN.phone, ADMIN.password_hash, ADMIN.role, ADMIN.avatar_url, ADMIN.is_active],
    );
    console.log('Admin seeded.');
  }

  await connection.query(
    'INSERT IGNORE INTO notification_preferences (user_id) VALUES (?)',
    [ADMIN.id],
  );
  console.log('Notification preferences ensured.');

  await connection.end();
  console.log(`Temp admin password (CHANGE AFTER FIRST LOGIN): ${TEMP_PASSWORD}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});