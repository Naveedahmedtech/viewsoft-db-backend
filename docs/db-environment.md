# Database environment setup

This document explains how to switch the backend to a different database engine and what environment variables to set.

**Supported dialects**: `postgres`, `mysql`, `mssql`.

The app reads configuration from `app/config/db.config.js` and selects the dialect via the `DATABASE_TYPE` environment variable (default: `postgres`). The Sequelize initializer is in `app/models/index.js` which calls `initDB(type)` using the value of `DATABASE_TYPE`.

Environment variables
- **DATABASE_TYPE**: `postgres` | `mysql` | `mssql` (default: `postgres`)
- **DB_HOST**: database host (default: `localhost`)
- **DB_USER**: database user (default: `postgres`)
- **DB_PASSWORD**: database password (default: empty)
- **DB_NAME**: database name (default: `dbbackend_viewsoft`)
- **DB_PORT**: optional port (defaults: postgres 5432, mysql 3306, mssql 1433)
- **DB_SSL**: `true` or `false` — enables SSL/dialectOptions when set to `true` (default: `false`)

CORS environment variables
- **CORS_ORIGINS** or **CORS_ALLOWED_ORIGINS**: comma-separated list of allowed origins, or `*` for all (default: `*`). Example: `http://localhost:4200,https://example.com`
- **CORS_METHODS**: comma-separated HTTP methods allowed (default: `GET, POST, PUT, DELETE, PATCH, OPTIONS`)
- **CORS_ALLOWED_HEADERS**: allowed request headers (default: `Content-Type, Authorization`)
- **CORS_CREDENTIALS**: `true` or `false` — whether to expose credentials (default: `false`)

Where environment variables are not provided, defaults come from `app/config/db.config.js`.

Quick examples

1) Use a `.env` file (the app uses `dotenv`). Example `.env` to use MySQL:

DATABASE_TYPE=mysql
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=secret
DB_NAME=dbbackend_viewsoft
DB_PORT=3306
DB_SSL=false

2) Windows - PowerShell (temporary, current shell):

``powershell
$env:DATABASE_TYPE = 'mysql'
$env:DB_HOST = '127.0.0.1'
$env:DB_USER = 'root'
$env:DB_PASSWORD = 'secret'
$env:DB_NAME = 'dbbackend_viewsoft'
$env:DB_PORT = '3306'
$env:DB_SSL = 'false'
node server.js
``

3) Windows - CMD (temporary, current shell):

``cmd
set DATABASE_TYPE=mysql
set DB_HOST=127.0.0.1
set DB_USER=root
set DB_PASSWORD=secret
set DB_NAME=dbbackend_viewsoft
set DB_PORT=3306
set DB_SSL=false
node server.js
``

4) Bash / WSL (temporary, current shell):

```bash
export DATABASE_TYPE=mysql
export DB_HOST=127.0.0.1
export DB_USER=root
export DB_PASSWORD=secret
export DB_NAME=dbbackend_viewsoft
export DB_PORT=3306
export DB_SSL=false
node server.js
```

Testing & scripts
- The server picks up `DATABASE_TYPE` at startup and logs the chosen dialect (see `server.js`).
- Scripts in `Scripts/` (e.g., `seed-bob.js`, `migrate-add-source-name-user-pdf.js`) also read `DATABASE_TYPE` and use the same config.
- To seed or run scripts with a different DB, set `DATABASE_TYPE` in the environment or `.env` and run the script, e.g.:

``bash
DATABASE_TYPE=mysql node Scripts/seed-bob.js
```

Notes and recommendations
- Ensure the appropriate DB driver is installed: `pg` for Postgres, `mysql2` for MySQL, and `tedious` for MSSQL — these are already listed in `package.json`.
- For production, prefer secure SSL configuration and a CA; `DB_SSL=true` will enable dialect-specific SSL options.
- When switching dialects, verify the target DB user has the required permissions and the schema/tables are created or synchronized. The app runs `sequelize.sync()` on startup by default.

If you want, I can add a sample `.env.example` file or update the README with a one-line command for your preferred DB.

