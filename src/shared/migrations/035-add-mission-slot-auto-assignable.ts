import { DataTypes } from 'sequelize';

/**
 * Adds the autoAssignable column to the MissionSlots table
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
