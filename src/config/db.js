const { Pool } = require("pg");
require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render/managed Postgres requires SSL in production; local dev usually doesn't.
  ssl: isProd ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
  process.exit(1);
});

/**
 * Runs a set of queries inside a single transaction. Pass an async function
 * that receives a client and does its queries with client.query(...).
 * Commits on success, rolls back automatically if anything throws.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  withTransaction,
};
