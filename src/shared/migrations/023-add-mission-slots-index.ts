/**
 * Adds a unique index to the MissionSlots table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addIndex('missionSlots', {
            name: 'missionSlots_unique_slotGroupUid_assigneeUid',
            fields: ['slotGroupUid', 'assigneeUid'],
            unique: true
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeIndex('missionSlots', 'missionSlots_unique_slotGroupUid_assigneeUid');
    }
};
