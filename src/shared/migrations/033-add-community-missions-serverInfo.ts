import { DataTypes } from 'sequelize';

/**
 * Adds the serverInfo columns to the Communities table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('communities', 'gameServers', {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: []
        });

        await queryInterface.addColumn('communities', 'voiceComms', {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: []
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('communities', 'voiceComms');
        await queryInterface.removeColumn('communities', 'gameServers');
    }
};
