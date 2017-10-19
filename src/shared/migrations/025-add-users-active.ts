import { DataTypes } from 'sequelize';

/**
 * Adds the active column to the Users table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('users', 'active', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('users', 'active');
    }
};
