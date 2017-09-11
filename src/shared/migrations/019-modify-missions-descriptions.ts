/**
 * Modify missions table to rename mission description/shortDescription column
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.renameColumn('missions', 'description', 'detailedDescription');
        await queryInterface.renameColumn('missions', 'shortDescription', 'description');
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.renameColumn('missions', 'description', 'shortDescription');
        await queryInterface.renameColumn('missions', 'detailedDescription', 'description');
    }
};
