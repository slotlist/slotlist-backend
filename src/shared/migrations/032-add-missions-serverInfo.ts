import { DataTypes } from 'sequelize';

/**
 * Adds the serverInfo columns to the Missions table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('missions', 'gameServer', {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null
        });

        await queryInterface.addColumn('missions', 'voiceComms', {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('missions', 'voiceComms');
        await queryInterface.removeColumn('missions', 'gameServer');
    }
};
