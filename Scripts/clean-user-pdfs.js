// Scripts/clean-user-pdfs.js
const { initDB, db } = require("../app/models");

const DB_TYPE = process.env.DATABASE_TYPE || "postgres";

async function main() {
  initDB(DB_TYPE);
  const { user_pdf, sequelize } = db;

  try {
    await sequelize.authenticate();

    const deleted = await user_pdf.destroy({ where: {}, truncate: true, force: true });
    console.log(`Deleted ${deleted} user_pdf rows (table truncated)`);
  } catch (err) {
    console.error("Cleanup failed:", err);
  } finally {
    await sequelize.close();
  }
}

main();
