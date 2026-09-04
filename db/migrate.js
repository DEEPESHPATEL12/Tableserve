/**
 * Simple migration runner: reads schema.sql and executes it against
 * the database pointed to by DATABASE_URL in .env
 *
 * Usage: npm run migrate
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  console.log("Running migration against:", process.env.DATABASE_URL?.split("@")[1] || "database");

  try {
    await pool.query(schemaSql);
    console.log("✅ Migration complete. All tables are ready.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
