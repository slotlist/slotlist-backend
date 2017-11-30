import { DataTypes, QueryTypes } from 'sequelize';

import { NOTIFICATION_TYPE_GENERIC, NOTIFICATION_TYPES } from '../types/notification';

/**
 * Creates table for Notification model
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.createTable('notifications', {
            uid: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            notificationType: {
                type: DataTypes.ENUM(NOTIFICATION_TYPES),
                allowNull: false,
                defaultValue: NOTIFICATION_TYPE_GENERIC
            },
            data: {
                type: DataTypes.JSONB,
                allowNull: false
            },
            seenAt: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null
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
            userUid: {
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
        await queryInterface.dropTable('notifications');
        await queryInterface.sequelize.query('DROP TYPE "enum_notifications_notificationType";', { type: QueryTypes.RAW });
    }
};
