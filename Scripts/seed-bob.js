const { initDB, db } = require("../app/models");

const DB_TYPE = process.env.DATABASE_TYPE || "postgres";

async function main() {
  initDB(DB_TYPE);
  const { user, sequelize } = db;

  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const [record, created] = await user.findOrCreate({
      where: { username: "bob" },
      defaults: {
        password: "123456",
        email: "bob@example.com",
        displayName: "bob",
      },
    });

    console.log(created ? "Seeded user 'bob'." : "User 'bob' already exists.");
    console.log("Login with username: bob, password: 123456");
  } catch (err) {
    console.error("Failed to seed user 'bob':", err.message || err);
  } finally {
    await sequelize.close();
  }
}

main();
