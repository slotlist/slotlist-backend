import { DataTypes } from 'sequelize';

/**
 * Adds the slotsAutoAssignable column to the Missions table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('missions', 'slotsAutoAssignable', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('missions', 'slotsAutoAssignable');
    }
};
