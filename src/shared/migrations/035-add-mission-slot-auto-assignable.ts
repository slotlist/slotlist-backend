import { DataTypes } from 'sequelize';

/**
 * Adds the repositories columns to the Communities and Missions tables and migrates existing `repositoryUrl`s
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('missionSlots', 'autoAssignable', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('missionSlots', 'autoAssignable');
    }
};
