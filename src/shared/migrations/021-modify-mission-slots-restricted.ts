import * as _ from 'lodash';
import { DataTypes, QueryTypes } from 'sequelize';

/**
 * Modify missionSlots table to change restricted column to restrictedCommunityUid reference
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        // Unfortunately, this migration destroys old restrictions since we cannot set a default value for a single community automatically
        await queryInterface.addColumn('missionSlots', 'restrictedCommunityUid', {
            type: DataTypes.UUID,
            allowNull: true,
            defaultValue: null,
            references: {
                model: 'communities',
                key: 'uid'
            },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });

        await queryInterface.removeColumn('missionSlots', 'restricted');
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('missionSlots', 'restricted', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });

        const previouslyRestricted = await queryInterface.sequelize.query(
            'SELECT "uid" FROM "missionSlots" WHERE "restrictedCommunityUid" IS NOT NULL;',
            { type: QueryTypes.SELECT });
        const previouslyRestrictedUids = _.map(previouslyRestricted, 'uid');

        await queryInterface.sequelize.query(
            'UPDATE "missionSlots" SET "restricted" = true WHERE "uid" IN (:previouslyRestrictedUids);',
            {
                type: QueryTypes.UPDATE,
                replacements: {
                    previouslyRestrictedUids
                }
            });

        await queryInterface.removeColumn('missionSlots', 'restrictedCommunityUid');
    }
};
