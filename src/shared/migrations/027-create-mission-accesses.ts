import { DataTypes } from 'sequelize';

/**
 * Creates table for MissionAccess model
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.createTable('missionAccesses', {
            uid: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            communityUid: {
                type: DataTypes.UUID,
                allowNull: true,
                defaultValue: null,
                references: {
                    model: 'communities',
                    key: 'uid'
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            },
            missionUid: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'missions',
                    key: 'uid'
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            },
            userUid: {
                type: DataTypes.UUID,
                allowNull: true,
                defaultValue: null,
                references: {
                    model: 'users',
                    key: 'uid'
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });

        await queryInterface.addIndex('missionAccesses', ['missionUid', 'communityUid'], {
            indexName: 'missionAccesses_unique_missionUid_communityUid',
            indicesType: 'UNIQUE',
            indexType: 'BTREE'
        });

        await queryInterface.addIndex('missionAccesses', ['missionUid', 'userUid'], {
            indexName: 'missionAccesses_unique_missionUid_userUid',
            indicesType: 'UNIQUE',
            indexType: 'BTREE'
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.dropTable('missionAccesses');
    }
};
