require("dotenv").config();
const { initDB, db } = require("../app/models");

async function migrate() {
  const dbType = (process.env.DATABASE_TYPE || "postgres").toLowerCase();
  initDB(dbType);

  const sequelize = db.sequelize;
  if (!sequelize) {
    throw new Error("Database is not initialized.");
  }

  try {
    await sequelize.authenticate();
    console.log(`[migration] Connected to ${dbType}`);

    if (dbType !== "postgres" && dbType !== "mssql") {
      throw new Error(`Unsupported DATABASE_TYPE: ${dbType}. Supported: postgres, mssql.`);
    }

    const columnCheckQuery = dbType === "postgres"
      ? `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'annotation'
          AND column_name IN ('created_by', 'updated_by')
        ORDER BY column_name;
      `
      : `
        SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'annotation'
          AND COLUMN_NAME IN ('created_by', 'updated_by')
        ORDER BY COLUMN_NAME;
      `;

    const [columns] = await sequelize.query(columnCheckQuery);

    const createdByType = columns.find((c) => c.column_name === "created_by")?.data_type;
    const updatedByType = columns.find((c) => c.column_name === "updated_by")?.data_type;

    const alreadyVarchar = dbType === "postgres"
      ? createdByType === "character varying" && updatedByType === "character varying"
      : (createdByType === "varchar" || createdByType === "nvarchar")
        && (updatedByType === "varchar" || updatedByType === "nvarchar");

    if (alreadyVarchar) {
      console.log("[migration] Skipped. annotation.created_by and annotation.updated_by are already varchar.");
      return;
    }

    await sequelize.transaction(async (t) => {
      if (dbType === "postgres") {
        await sequelize.query(
          `
          ALTER TABLE public.annotation
            DROP CONSTRAINT IF EXISTS annotation_created_by_fkey,
            DROP CONSTRAINT IF EXISTS annotation_updated_by_fkey;
          `,
          { transaction: t }
        );

        await sequelize.query(
          `
          ALTER TABLE public.annotation
            ALTER COLUMN created_by TYPE varchar(255) USING created_by::varchar(255),
            ALTER COLUMN updated_by TYPE varchar(255) USING updated_by::varchar(255);
          `,
          { transaction: t }
        );
      } else {
        await sequelize.query(
          `
          DECLARE @sql NVARCHAR(MAX) = N'';

          SELECT @sql = @sql + N'ALTER TABLE [annotation] DROP CONSTRAINT [' + fk.name + N'];'
          FROM sys.foreign_keys fk
          INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
          INNER JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
          INNER JOIN sys.tables t ON t.object_id = fk.parent_object_id
          WHERE t.name = 'annotation'
            AND c.name IN ('created_by', 'updated_by');

          IF LEN(@sql) > 0
            EXEC sp_executesql @sql;
          `,
          { transaction: t }
        );

        await sequelize.query(
          `
          ALTER TABLE [annotation] ALTER COLUMN [created_by] VARCHAR(255) NULL;
          ALTER TABLE [annotation] ALTER COLUMN [updated_by] VARCHAR(255) NULL;
          `,
          { transaction: t }
        );
      }
    });

    console.log("[migration] Success. annotation.created_by and annotation.updated_by converted to varchar(255).");
  } catch (error) {
    console.error("[migration] Failed:", error.message || error);
    process.exitCode = 1;
  } finally {
    if (sequelize) {
      await sequelize.close();
    }
  }
}

migrate();
