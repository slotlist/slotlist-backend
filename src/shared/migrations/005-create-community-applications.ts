import { DataTypes, QueryTypes } from 'sequelize';

import { COMMUNITY_APPLICATION_STATUS_SUBMITTED, COMMUNITY_APPLICATION_STATUSES } from '../models/CommunityApplication';

/**
 * Creates table for CommunityApplication model
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.createTable('communityApplications', {
            uid: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            status: {
                type: DataTypes.ENUM(COMMUNITY_APPLICATION_STATUSES),
                allowNull: false,
                defaultValue: COMMUNITY_APPLICATION_STATUS_SUBMITTED
            },
            communityUid: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'communities',
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

        await queryInterface.addIndex('communityApplications', ['communityUid', 'userUid'], {
            indexName: 'communityApplications_unique_communityUid_userUid',
            indicesType: 'UNIQUE',
            indexType: 'BTREE'
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.dropTable('communityApplications');
        await queryInterface.sequelize.query('DROP TYPE "enum_communityApplications_status";', { type: QueryTypes.RAW });
    }
};
