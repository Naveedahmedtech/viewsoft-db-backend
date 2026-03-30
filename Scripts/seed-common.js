require("dotenv").config();
const { initDB, db } = require("./app/models");

const initialUsers = [
  { username: "admin", password: "123456", email: "admin@example.com", displayName: "admin" },
  { username: "user1", password: "123456", email: "user1@example.com", displayName: "user 1" },
  { username: "user2", password: "123456", email: "user2@example.com", displayName: "user 2" },
  { username: "user3", password: "123456", email: "user3@example.com", displayName: "user 3" },
];

const initialProject = { name: "Demo project" };

const initialPermissions = [
  { key: "Annotation.View" },
  { key: "Annotation.Add" },
  { key: "Annotation.Update" },
  { key: "Annotation.Delete" },
];

const initialAnnotations = [
  { docId: "doc-1", data: JSON.stringify({ message: "Test annotation 1" }), createdBy: "1", updatedBy: "1" },
  { docId: "doc-1", data: JSON.stringify({ message: "Test annotation 2" }), createdBy: "1", updatedBy: "1" },
  { docId: "doc-2", data: JSON.stringify({ message: "Test annotation 3" }), createdBy: "2", updatedBy: "2" },
  { docId: "doc-2", data: JSON.stringify({ message: "Test annotation 4" }), createdBy: "2", updatedBy: "2" },
  { docId: "doc-collab", data: JSON.stringify({ message: "Test annotation collab" }), createdBy: "collab", updatedBy: "collab" },
];

const initialProjectUserPermissions = [
  { username: "admin", permKey: "Annotation.View" },
  { username: "user1", permKey: "Annotation.View" },
  { username: "user2", permKey: "Annotation.View" },
  { username: "user3", permKey: "Annotation.View" },
  { username: "user3", permKey: "Annotation.Add" },
];

async function seedDatabase(dbType) {
  initDB(dbType);
  const { sequelize, user, project, permission, annotation, project_user_permission } = db;

  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const usersByName = new Map();
    for (const u of initialUsers) {
      const [record, created] = await user.findOrCreate({
        where: { username: u.username },
        defaults: u,
      });
      usersByName.set(u.username, record.id);
      console.log(created ? `User created: ${u.username}` : `User exists: ${u.username}`);
    }

    const [projectRecord, projectCreated] = await project.findOrCreate({
      where: { name: initialProject.name },
      defaults: initialProject,
    });
    console.log(
      projectCreated
        ? `Project created: id: ${projectRecord.id}, name: ${projectRecord.name}`
        : `Project exists: id: ${projectRecord.id}, name: ${projectRecord.name}`
    );

    const permsByKey = new Map();
    for (const p of initialPermissions) {
      const [record, created] = await permission.findOrCreate({
        where: { key: p.key },
        defaults: p,
      });
      permsByKey.set(p.key, record.id);
      console.log(created ? `Permission created: ${p.key}` : `Permission exists: ${p.key}`);
    }

    for (const a of initialAnnotations) {
      const [record, created] = await annotation.findOrCreate({
        where: { projId: projectRecord.id, docId: a.docId, data: a.data },
        defaults: {
          projId: projectRecord.id,
          docId: a.docId,
          data: a.data,
          createdBy: a.createdBy,
          updatedBy: a.updatedBy,
        },
      });
      console.log(
        created ? `Annotation created: ${record.id}` : `Annotation exists: ${record.id}`
      );
    }

    for (const pup of initialProjectUserPermissions) {
      const userId = usersByName.get(pup.username);
      const permId = permsByKey.get(pup.permKey);
      if (!userId || !permId) {
        console.log(
          `Skipping ProjectUserPermission: missing user or permission for ${pup.username}/${pup.permKey}`
        );
        continue;
      }
      const [record, created] = await project_user_permission.findOrCreate({
        where: { projId: projectRecord.id, userId, permId },
        defaults: { projId: projectRecord.id, userId, permId },
      });
      console.log(
        created
          ? `ProjectUserPermission created: ${record.id}`
          : `ProjectUserPermission exists: ${record.id}`
      );
    }
  } catch (err) {
    console.error("Failed to seed database:", err.message || err);
    process.exitCode = 1;
  } finally {
    if (sequelize) {
      await sequelize.close();
    }
  }
}

module.exports = { seedDatabase };

if (require.main === module) {
  const dbType = process.env.DATABASE_TYPE || "mssql";
  seedDatabase(dbType);
}
