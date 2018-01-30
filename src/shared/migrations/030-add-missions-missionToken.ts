import { DataTypes } from 'sequelize';

/**
 * Adds the missionToken column to the Missions table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('missions', 'missionToken', {
            type: DataTypes.UUID,
            allowNull: true,
            defaultValue: null
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('missions', 'missionToken');
    }
};
