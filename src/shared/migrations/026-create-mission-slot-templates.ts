import { DataTypes } from 'sequelize';

import { MISSION_VISIBILITIES, MISSION_VISIBILITY_HIDDEN } from '../models/Mission';

/**
 * Creates table for MissionSlotTemplate model
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.createTable('missionSlotTemplates', {
            uid: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            slotGroups: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: []
            },
            visibility: {
                type: DataTypes.ENUM(MISSION_VISIBILITIES),
                allowNull: false,
                defaultValue: MISSION_VISIBILITY_HIDDEN
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
            },
            creatorUid: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'uid'
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            }
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.dropTable('missionSlotTemplates');
    }
};
