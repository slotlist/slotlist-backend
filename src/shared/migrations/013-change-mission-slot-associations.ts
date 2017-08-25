import * as _ from 'lodash';
import { DataTypes, QueryTypes } from 'sequelize';

/**
 * Changes the associations of mission slots to reference slot groups instead of missions directly
 * Unfortunately, this breaking change forces us to flush all our mission slot entries since the associations cannot be made automatically
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        const oldSlotAssociations = await queryInterface.sequelize.query('SELECT "uid", "missionUid" FROM "missionSlots";', { type: QueryTypes.SELECT });

        await queryInterface.removeColumn('missionSlots', 'missionUid');
        await queryInterface.addColumn('missionSlots', 'slotGroupUid', {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'missionSlotGroups',
                key: 'uid'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        const missionUids = await queryInterface.sequelize.query('SELECT "uid" FROM "missions";', { type: QueryTypes.SELECT });

        await Promise.each(missionUids, async (missionUid: any) => {
            const result = await queryInterface.sequelize.query(
                'INSERT INTO "missionSlotGroups"("uid", "title", "description", "orderNumber", "missionUid", "createdAt", "updatedAt") ' +
                'VALUES(uuid_generate_v4(), \'Slot group\', \'Auto-generated via migration\', 0, :missionUid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING "uid";',
                {
                    type: QueryTypes.INSERT,
                    replacements: {
                        missionUid: missionUid.uid
                    }
                });
            const slotGroupUid = result[0][0].uid;

            const oldSlotUids = _.map(_.filter(oldSlotAssociations, { missionUid: missionUid.uid }), 'uid');

            await queryInterface.sequelize.query(
                'UPDATE "missionSlots" SET "slotGroupUid" = :slotGroupUid WHERE "uid" IN (:oldSlotUids);',
                {
                    type: QueryTypes.SELECT,
                    replacements: {
                        slotGroupUid,
                        oldSlotUids
                    }
                });
        });

        await queryInterface.changeColumn('missionSlots', 'slotGroupUid', {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'missionSlotGroups',
                key: 'uid'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('missionSlots', 'slotGroupUid');
        await queryInterface.addColumn('missionSlots', 'missionUid', {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'missions',
                key: 'uid'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        // TODO 2017-08-25: revert associations to old missions, similar to code above
    }
};
