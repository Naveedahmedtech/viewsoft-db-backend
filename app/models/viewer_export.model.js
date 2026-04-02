module.exports = (sequelize, Sequelize) => {
  const ViewerExport = sequelize.define("viewer_export", {
    id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    fileId: {
      type: Sequelize.STRING(255),
      allowNull: true,
      field: "file_id",
    },
    fileName: {
      type: Sequelize.STRING(255),
      allowNull: true,
      field: "file_name",
    },
    sourceFileUrl: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: "source_file_url",
    },
    exportedUrl: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: "exported_url",
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
    tableName: "viewer_export",
    indexes: [
      {
        fields: ["file_id"],
      },
      {
        fields: ["updated_at"],
      },
    ],
  });

  return ViewerExport;
};
