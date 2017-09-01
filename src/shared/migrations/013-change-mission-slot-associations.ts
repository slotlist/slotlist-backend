import * as _ from 'lodash';
import { DataTypes, QueryTypes } from 'sequelize';

/**
 * Changes the associations of mission slots to reference slot groups instead of missions directly
 * Unfortunately, this breaking change forces us to flush all our mission slot entries since the associations cannot be made automatically
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', { type: QueryTypes.RAW });

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

            if (!_.isEmpty(oldSlotUids)) {
                await queryInterface.sequelize.query(
                    'UPDATE "missionSlots" SET "slotGroupUid" = :slotGroupUid WHERE "uid" IN (:oldSlotUids);',
                    {
                        type: QueryTypes.UPDATE,
                        replacements: {
                            slotGroupUid,
                            oldSlotUids
                        }
                    });
            }
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
        const oldSlotAssociations = await queryInterface.sequelize.query(
            'SELECT "missionSlots"."uid", "slotGroupUid", "missionUid" FROM "missionSlots" JOIN "missionSlotGroups" ON ' +
            '"missionSlots"."slotGroupUid" = "missionSlotGroups"."uid";',
            { type: QueryTypes.SELECT });

        await queryInterface.removeColumn('missionSlots', 'slotGroupUid');
        await queryInterface.addColumn('missionSlots', 'missionUid', {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'missions',
                key: 'uid'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        let slotGroupsToDelete: string[] = [];
        await Promise.each(oldSlotAssociations, (slotAssociation: any) => {
            slotGroupsToDelete.push(slotAssociation.slotGroupUid);

            return queryInterface.sequelize.query(
                'UPDATE "missionSlots" SET "missionUid" = :missionUid WHERE "uid" = :slotUid;',
                {
                    type: QueryTypes.UPDATE,
                    replacements: {
                        slotUid: slotAssociation.uid,
                        missionUid: slotAssociation.missionUid
                    }
                });
        });

        await queryInterface.changeColumn('missionSlots', 'missionUid', {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'missions',
                key: 'uid'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });

        slotGroupsToDelete = _.uniq(slotGroupsToDelete);
        if (!_.isEmpty(slotGroupsToDelete)) {
            await queryInterface.sequelize.query(
                'DELETE FROM "missionSlotGroups" WHERE uid IN (:slotGroupUids);',
                {
                    type: QueryTypes.DELETE,
                    replacements: {
                        slotGroupUids: slotGroupsToDelete
                    }
                });
        }
    }
};
