# Multi-Database Support

This project already supports multiple Sequelize dialects (PostgreSQL, MySQL, MSSQL) through the files listed below.

## Key files to share
- `server.js` – sets `DATABASE_TYPE` (defaults to `postgres`) and passes it to `app/models/index.js`.
- `app/models/index.js` – looks up the requested dialect in `app/config/db.config.js`, initializes Sequelize, and exposes the shared models.
- `app/config/db.config.js` – defines the `postgres`, `mysql`, and `mssql` configs plus the common connection pool settings.
- `.env` – sample environment variables for the database credentials and `DATABASE_TYPE`.

When handing these files to someone else, they can replace them directly and then:

1. Copy the `.env` section (or re-create it) with their own host/port/user/password/db name.
2. Set `DATABASE_TYPE` to `postgres`, `mysql`, or `mssql` as needed.
3. Run `npm install dotenv` before starting the server so `server.js` and any other modules can load the `.env` file.

With those files and environment variables in place, starting the app will connect to the chosen database dialect automatically.
