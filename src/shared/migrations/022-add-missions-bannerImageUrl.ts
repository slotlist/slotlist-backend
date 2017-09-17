import { DataTypes } from 'sequelize';

/**
 * Adds the bannerImageUrl column to the Missions table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('missions', 'bannerImageUrl', {
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
        await queryInterface.removeColumn('missions', 'bannerImageUrl');
    }
};
