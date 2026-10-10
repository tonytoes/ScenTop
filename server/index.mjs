import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

const requiredVariables = ['DATABASE_URL', 'JWT_SECRET'];
for (const name of requiredVariables) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

const app = express();
const sql = neon(process.env.DATABASE_URL);
const port = Number(process.env.PORT || 3000);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:4200' }));
app.use(express.json({ limit: '20kb' }));

function publicUser(user) {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
  };
}

function createToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d', issuer: 'scentop-api', audience: 'scentop-app' },
  );
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.get('/api/health', async (_request, response) => {
  try {
    await sql`SELECT 1`;
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error(error);
    response.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.post('/api/auth/register', async (request, response) => {
  try {
    const firstName = String(request.body.firstName ?? '').trim();
    const lastName = String(request.body.lastName ?? '').trim();
    const email = String(request.body.email ?? '').trim().toLowerCase();
    const password = String(request.body.password ?? '');

    if (!firstName || !lastName || !validEmail(email) || password.length < 8) {
      return response.status(400).json({
        message: 'Provide your name, a valid email, and a password with at least 8 characters.',
      });
    }

    const existing = await sql`SELECT id FROM users WHERE LOWER(email) = ${email} LIMIT 1`;
    if (existing.length) {
      return response.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const rows = await sql`
      INSERT INTO users (first_name, last_name, email, password_hash)
      VALUES (${firstName}, ${lastName}, ${email}, ${passwordHash})
      RETURNING id, first_name, last_name, email
    `;
    const user = rows[0];
    return response.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: 'Could not create the account.' });
  }
});

app.post('/api/auth/login', async (request, response) => {
  try {
    const email = String(request.body.email ?? '').trim().toLowerCase();
    const password = String(request.body.password ?? '');
    const rows = await sql`
      SELECT id, first_name, last_name, email, password_hash
      FROM users
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `;
    const user = rows[0];
    const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !passwordMatches) {
      return response.status(401).json({ message: 'Incorrect email or password.' });
    }

    return response.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: 'Could not log in.' });
  }
});

app.listen(port, () => {
  console.log(`ScenTop API running on http://localhost:${port}`);
});
