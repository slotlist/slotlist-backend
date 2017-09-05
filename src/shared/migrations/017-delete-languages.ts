import { DataTypes } from 'sequelize';

/**
 * Delete unused Languages table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.dropTable('languages');
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.createTable('languages', {
            shortCode: {
                type: DataTypes.STRING(2),
                allowNull: false,
                primaryKey: true,
                validate: {
                    notEmpty: true
                }
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                validate: {
                    notEmpty: true
                }
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });
    }
};
