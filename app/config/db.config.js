const useSsl = String(process.env.DB_SSL || "").toLowerCase() === "true";

const env = {
  host: process.env.DB_HOST || "localhost",
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "dbbackend_viewsoft",
};

const defaultPorts = {
  postgres: 5432,
  mysql: 3306,
  mssql: 1433,
};

function getDialectOptions(dialect) {
  if (dialect === "postgres" || dialect === "mysql") {
    return {
      ssl: useSsl
        ? {
            require: true,
            rejectUnauthorized: false, // OK for quick test; prefer true with CA in prod
          }
        : false,
    };
  }

  if (dialect === "mssql") {
    return {
      options: {
        encrypt: useSsl,
        trustServerCertificate: !useSsl,
      },
    };
  }

  return {};
}

function buildConfig(dialect) {
  return {
    host: env.host,
    port: Number(process.env.DB_PORT) || defaultPorts[dialect],
    username: env.username,
    password: env.password,
    database: env.database,
    dialect,
    dialectOptions: getDialectOptions(dialect),
  };
}

module.exports = {
  postgres: buildConfig("postgres"),
  mysql: buildConfig("mysql"),
  mssql: buildConfig("mssql"),

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};
