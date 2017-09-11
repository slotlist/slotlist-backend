import { DataTypes } from 'sequelize';

/**
 * Modify missions table to change type of repositoryUrl column
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.changeColumn('missions', 'repositoryUrl', {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
            validate: {
                notEmpty: true
            }
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.changeColumn('missions', 'repositoryUrl', {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            validate: {
                notEmpty: true,
                isUrl: true
            }
        });
    }
};
