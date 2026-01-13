const db = require("../models").db;
const UserPdf = db.user_pdf;
const Op = db.Sequelize.Op;

// Create or update a user PDF entry
exports.create = async (req, res) => {
  const userId = req.body?.userId;
  const sourceName = req.body?.sourceName || null;
  const fileName = req.body?.fileName;
  const filePath = req.body?.filePath;

  if (!userId || !fileName || !filePath) {
    return res.status(400).send({
      message: "userId, fileName and filePath are required.",
    });
  }

  try {
    const existing = await UserPdf.findOne({
      where: {
        [Op.and]: [{ userId }, { fileName }, { sourceName }],
      },
    });

    if (existing) {
      const updated = await existing.update({ filePath, sourceName });
      return res.send(updated);
    }

    const created = await UserPdf.create({ userId, fileName, filePath, sourceName });
    return res.status(201).send(created);
  } catch (err) {
    console.error("Failed to upsert user PDF", err);
    return res.status(500).send({
      message: err.message || "Failed to save user PDF.",
    });
  }
};

// List PDFs for a user
exports.findAll = async (req, res) => {
  const userId = parseInt(req.query?.userId, 10);
  const sourceName = req.query?.sourceName || null;

  if (!userId) {
    return res.status(400).send({
      message: "Query param userId is required.",
    });
  }

  try {
    const items = await UserPdf.findAll({
      where: {
        [Op.and]: [
          { userId },
          sourceName ? { sourceName } : {},
        ],
      },
      order: [["updatedAt", "DESC"]],
    });
    return res.send(items);
  } catch (err) {
    console.error("Failed to fetch user PDFs", err);
    return res.status(500).send({
      message: err.message || "Failed to fetch user PDFs.",
    });
  }
};
