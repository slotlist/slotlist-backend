import { DataTypes } from 'sequelize';

/**
 * Adds the requiredDLCs column to the MissionSlots table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('missionSlots', 'requiredDLCs', {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: false,
            defaultValue: []
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('missionSlots', 'requiredDLCs');
    }
};
