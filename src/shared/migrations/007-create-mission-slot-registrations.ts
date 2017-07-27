import { DataTypes } from 'sequelize';

/**
 * Creates table for MissionSlotRegistration model
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.createTable('missionSlotRegistrations', {
            uid: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            confirmed: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            slotUid: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'missionSlots',
                    key: 'uid'
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            },
            userUid: {
                type: DataTypes.UUID,
                allowNull: false,
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

        await queryInterface.addIndex('missionSlotRegistrations', ['slotUid', 'userUid'], {
            indexName: 'missionSlotRegistrations_unique_slotUid_userUid',
            indicesType: 'UNIQUE',
            indexType: 'BTREE'
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.dropTable('missionSlotRegistrations');
    }
};
