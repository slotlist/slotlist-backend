/**
 * Modify missionSlots table to rename slot description/shortDescription column
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.renameColumn('missionSlots', 'description', 'detailedDescription');
        await queryInterface.renameColumn('missionSlots', 'shortDescription', 'description');
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.renameColumn('missionSlots', 'description', 'shortDescription');
        await queryInterface.renameColumn('missionSlots', 'detailedDescription', 'description');
    }
};
