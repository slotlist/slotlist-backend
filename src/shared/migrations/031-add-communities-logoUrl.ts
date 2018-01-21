import { DataTypes } from 'sequelize';

/**
 * Adds the logoUrl column to the Communities table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('communities', 'logoUrl', {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            validate: {
                notEmpty: true,
                isUrl: true
            }
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('communities', 'logoUrl');
    }
};
