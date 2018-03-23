import { DataTypes, QueryTypes } from 'sequelize';

import { ANNOUNCEMENT_TYPE_GENERIC, ANNOUNCEMENT_TYPES } from '../models/Announcement';

/**
 * Creates table for Announcement model
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.createTable('announcements', {
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
            content: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            announcementType: {
                type: DataTypes.ENUM(ANNOUNCEMENT_TYPES),
                allowNull: false,
                defaultValue: ANNOUNCEMENT_TYPE_GENERIC
            },
            visibleFrom: {
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
        await queryInterface.dropTable('announcements');
        await queryInterface.sequelize.query('DROP TYPE "enum_announcements_announcementType";', { type: QueryTypes.RAW });
    }
};
