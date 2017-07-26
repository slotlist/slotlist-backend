import { Community } from './Community';
import { CommunityApplication } from './CommunityApplication';
import { Mission } from './Mission';
import { MissionSlot } from './MissionSlot';
import { MissionSlotRegistration } from './MissionSlotRegistration';
import { Permission } from './Permission';
import { User } from './User';

/**
 * Creates association between sequelize models.
 * This gets executed after all models have been created so circular references work properly
 *
 * @export
 */
export function createAssociations(): void {
    Community.associations.applications = Community.hasMany(CommunityApplication, { as: 'applications', foreignKey: 'communityUid' });
    Community.associations.members = Community.hasMany(User, { as: 'members', foreignKey: 'communityUid' });
    Community.associations.missions = Community.hasMany(Mission, { as: 'missions', foreignKey: 'communityUid' });

    CommunityApplication.associations.community = CommunityApplication.belongsTo(Community, { as: 'community', foreignKey: 'communityUid' });
    CommunityApplication.associations.user = CommunityApplication.belongsTo(User, { as: 'user', foreignKey: 'userUid' });

    Mission.associations.community = Mission.belongsTo(Community, { as: 'community', foreignKey: 'communityUid' });
    Mission.associations.creator = Mission.belongsTo(User, { as: 'creator', foreignKey: 'creatorUid' });
    Mission.associations.slots = Mission.hasMany(MissionSlot, { as: 'slots', foreignKey: 'missionUid' });

    MissionSlot.associations.assignee = MissionSlot.belongsTo(User, { as: 'assignee', foreignKey: 'assigneeUid' });
    MissionSlot.associations.mission = MissionSlot.belongsTo(Mission, { as: 'mission', foreignKey: 'missionUid' });
    MissionSlot.associations.registrations = MissionSlot.hasMany(MissionSlotRegistration, { as: 'registrations', foreignKey: 'slotUid' });

    MissionSlotRegistration.associations.slot = MissionSlotRegistration.belongsTo(MissionSlot, { as: 'slot', foreignKey: 'slotUid' });
    MissionSlotRegistration.associations.user = MissionSlotRegistration.belongsTo(User, { as: 'user', foreignKey: 'userUid' });

    Permission.associations.user = Permission.belongsTo(User, { as: 'user', foreignKey: 'userUid' });

    User.associations.applications = User.hasMany(CommunityApplication, { as: 'applications', foreignKey: 'userUid' });
    User.associations.community = User.belongsTo(Community, { as: 'community', foreignKey: 'communityUid' });
    User.associations.missions = User.hasMany(Mission, { as: 'missions', foreignKey: 'creatorUid' });
    User.associations.missionSlots = User.hasMany(MissionSlot, { as: 'missionSlots', foreignKey: 'assigneeUid' });
    User.associations.missionSlotRegistrations = User.hasMany(MissionSlotRegistration, { as: 'missionSlotRegistrations', foreignKey: 'userUid' });
    User.associations.permissions = User.hasMany(Permission, { as: 'permissions', foreignKey: 'userUid' });
}

export default createAssociations;
