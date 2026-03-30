module.exports = (sequelize, Sequelize) => {
  const Annotation = sequelize.define("annotation", {
    projId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: "proj_id",
      references: {
        model: 'project',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    docId: {
      type: Sequelize.STRING(255),
      allowNull: false,
      field: "doc_id",
    },
    roomId: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: "room_id",
    },
    data: {
      type: Sequelize.TEXT,
      comment: 'string data'
    },
    createdBy: {
      type: Sequelize.STRING(255),
      field: "created_by"
    },
    updatedBy: {
      type: Sequelize.STRING(255),
      field: "updated_by"
    },
    isDeleted: {
      type: Sequelize.BOOLEAN,
      field: "is_deleted",
      defaultValue: false
    },
    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
      field: "created_at"
    },
    updatedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
      field: "updated_at"
    }
  }, {
    // Additional model options can go here
    tableName: "annotation",
    hasTrigger: true
  });

  return Annotation;
};
