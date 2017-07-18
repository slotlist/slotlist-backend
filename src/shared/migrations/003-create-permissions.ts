import * as Sequelize from 'sequelize';

/**
 * Creates table for Permission model
 */
module.exports = {
    up: async (queryInterface: Sequelize.QueryInterface): Promise<void> => {
        await queryInterface.createTable('permissions', {
            uid: {
                type: Sequelize.UUID,
                allowNull: false,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            permission: {
                type: Sequelize.STRING,
                allowNull: false
            },
            userUid: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'uid'
                },
                onDelete: 'CASCADE'
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });

        await (<any>queryInterface).addIndex('permissions', ['userUid', 'permission'], {
            indexName: 'permissions_unique_userUid_permission',
            indicesType: 'UNIQUE',
            indexType: 'BTREE'
        });
    },
    down: async (queryInterface: Sequelize.QueryInterface): Promise<void> => {
        await queryInterface.dropTable('permissions');
    }
};
