module.exports = (sequelize, Sequelize) => {
  const UserPdf = sequelize.define("user_pdf", {
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: "user_id",
    },
    fileName: {
      type: Sequelize.STRING(255),
      allowNull: false,
      field: "file_name",
    },
    filePath: {
      type: Sequelize.STRING(1024),
      allowNull: false,
      field: "file_path",
    },
    sourceName: {
      type: Sequelize.STRING(255),
      allowNull: true,
      field: "source_name",
    },
    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
      field: "created_at",
    },
    updatedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
      field: "updated_at",
    },
  }, {
    tableName: "user_pdf",
    indexes: [
      {
        unique: true,
        fields: ["user_id", "file_name", "source_name"],
      },
    ],
  });

  return UserPdf;
};
