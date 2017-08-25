import { DataTypes, QueryTypes } from 'sequelize';

import { MISSION_VISIBILITIES, MISSION_VISIBILITY_HIDDEN } from '../models/Mission';

/**
 * Adds the visibility column to the Missions table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('missions', 'visibility', {
            type: DataTypes.ENUM(MISSION_VISIBILITIES),
            allowNull: false,
            defaultValue: MISSION_VISIBILITY_HIDDEN
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('missions', 'visibility');
        await queryInterface.sequelize.query('DROP TYPE "enum_missions_visibility";', { type: QueryTypes.RAW });
    }
};
