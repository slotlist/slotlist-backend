import { DataTypes } from 'sequelize';

/**
 * Removes the deletedAt columns of the Community and User table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('communities', 'deletedAt');
        await queryInterface.removeColumn('users', 'deletedAt');
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('communities', 'deletedAt', {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
        await queryInterface.addColumn('users', 'deletedAt', {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
};
