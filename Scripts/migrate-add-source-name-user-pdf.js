// Adds source_name column to user_pdf and recreates the unique index including it.
const { initDB, db } = require("../app/models");

const DB_TYPE = process.env.DATABASE_TYPE || "postgres";

async function run() {
  initDB(DB_TYPE);
  const { sequelize } = db;
  const qi = sequelize.getQueryInterface();

  try {
    await sequelize.authenticate();

    // Add column if missing
    await qi.sequelize.query(
      'ALTER TABLE IF EXISTS "user_pdf" ADD COLUMN IF NOT EXISTS "source_name" VARCHAR(255);'
    );

    // Drop old index if exists (without source_name)
    await qi.sequelize.query(
      'DROP INDEX IF EXISTS "user_pdf_user_id_file_name";'
    );

    // Create new unique index including source_name
    await qi.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "user_pdf_user_id_file_name_source_name" ON "user_pdf" ("user_id", "file_name", "source_name");'
    );

    console.log("Migration completed: source_name added and index updated.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await sequelize.close();
  }
}

run();
