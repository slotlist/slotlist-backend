import { DataTypes } from 'sequelize';

/**
 * Adds the collapsedDescription column to the Missions table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('missions', 'collapsedDescription', {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
            validate: {
                notEmpty: true
            }
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('missions', 'collapsedDescription');
    }
};
