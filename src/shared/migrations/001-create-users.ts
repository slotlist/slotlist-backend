import * as Sequelize from 'sequelize';

/**
 * Creates table for User model
 */
module.exports = {
    up: async (queryInterface: Sequelize.QueryInterface): Promise<void> => {
        await queryInterface.createTable('Users', {
            uid: {
                type: Sequelize.UUID,
                allowNull: false,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            nickname: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            steamId: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            deletedAt: {
                type: Sequelize.DATE,
                allowNull: true,
                defaultValue: null
            }
        });
    },
    down: async (queryInterface: Sequelize.QueryInterface): Promise<void> => {
        await queryInterface.dropTable('Users');
    }
};
