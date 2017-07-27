import { DataTypes } from 'sequelize';

/**
 * Adds the comment column to the MissionSlotRegistrations table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('missionSlotRegistrations', 'comment', {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            validate: {
                notEmpty: true
            }
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('missionSlotRegistrations', 'comment');
    }
};
