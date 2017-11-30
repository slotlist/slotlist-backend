import { Community } from './Community';
import { CommunityApplication } from './CommunityApplication';
import { Mission } from './Mission';
import { MissionAccess } from './MissionAccess';
import { MissionSlot } from './MissionSlot';
import { MissionSlotGroup } from './MissionSlotGroup';
import { MissionSlotRegistration } from './MissionSlotRegistration';
import { MissionSlotTemplate } from './MissionSlotTemplate';
import { Notification } from './Notification';
import { Permission } from './Permission';
import { User } from './User';

/**
 * Creates association between sequelize models.
 * This gets executed after all models have been created so circular references work properly
 *
 * @export
 */
// tslint:disable:max-line-length
export function createAssociations(): void {
    Community.associations.applications = Community.hasMany(CommunityApplication, { as: 'applications', foreignKey: 'communityUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    Community.associations.members = Community.hasMany(User, { as: 'members', foreignKey: 'communityUid', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
    Community.associations.missionAccesses = Community.hasMany(MissionAccess, { as: 'missionAccesses', foreignKey: 'communityUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    Community.associations.missions = Community.hasMany(Mission, { as: 'missions', foreignKey: 'communityUid', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
    Community.associations.restrictedSlots = Community.hasMany(MissionSlot, { as: 'restrictedSlots', foreignKey: 'restrictedCommunityUid', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

    CommunityApplication.associations.community = CommunityApplication.belongsTo(Community, { as: 'community', foreignKey: 'communityUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    CommunityApplication.associations.user = CommunityApplication.belongsTo(User, { as: 'user', foreignKey: 'userUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    Mission.associations.community = Mission.belongsTo(Community, { as: 'community', foreignKey: 'communityUid', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
    Mission.associations.creator = Mission.belongsTo(User, { as: 'creator', foreignKey: 'creatorUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    Mission.associations.missionAccesses = Mission.hasMany(MissionAccess, { as: 'missionAccesses', foreignKey: 'missionUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    Mission.associations.slotGroups = Mission.hasMany(MissionSlotGroup, { as: 'slotGroups', foreignKey: 'missionUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    MissionAccess.associations.community = MissionAccess.belongsTo(Community, { as: 'community', foreignKey: 'communityUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    MissionAccess.associations.mission = MissionAccess.belongsTo(Mission, { as: 'mission', foreignKey: 'missionUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    MissionAccess.associations.user = MissionAccess.belongsTo(User, { as: 'user', foreignKey: 'userUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    MissionSlot.associations.assignee = MissionSlot.belongsTo(User, { as: 'assignee', foreignKey: 'assigneeUid', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
    MissionSlot.associations.registrations = MissionSlot.hasMany(MissionSlotRegistration, { as: 'registrations', foreignKey: 'slotUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    MissionSlot.associations.restrictedCommunity = MissionSlot.belongsTo(Community, { as: 'restrictedCommunity', foreignKey: 'restrictedCommunityUid', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
    MissionSlot.associations.slotGroup = MissionSlot.belongsTo(MissionSlotGroup, { as: 'slotGroup', foreignKey: 'slotGroupUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    MissionSlotGroup.associations.mission = MissionSlotGroup.belongsTo(Mission, { as: 'mission', foreignKey: 'missionUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    MissionSlotGroup.associations.slots = MissionSlotGroup.hasMany(MissionSlot, { as: 'slots', foreignKey: 'slotGroupUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    MissionSlotRegistration.associations.slot = MissionSlotRegistration.belongsTo(MissionSlot, { as: 'slot', foreignKey: 'slotUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    MissionSlotRegistration.associations.user = MissionSlotRegistration.belongsTo(User, { as: 'user', foreignKey: 'userUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    MissionSlotTemplate.associations.creator = MissionSlotTemplate.belongsTo(User, { as: 'creator', foreignKey: 'creatorUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    Notification.associations.user = Notification.belongsTo(User, { as: 'user', foreignKey: 'userUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    Permission.associations.user = Permission.belongsTo(User, { as: 'user', foreignKey: 'userUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

    User.associations.applications = User.hasMany(CommunityApplication, { as: 'applications', foreignKey: 'userUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    User.associations.community = User.belongsTo(Community, { as: 'community', foreignKey: 'communityUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    User.associations.missionAccesses = User.hasMany(MissionAccess, { as: 'missionAccesses', foreignKey: 'userUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    User.associations.missions = User.hasMany(Mission, { as: 'missions', foreignKey: 'creatorUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    User.associations.missionSlots = User.hasMany(MissionSlot, { as: 'missionSlots', foreignKey: 'assigneeUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    User.associations.missionSlotRegistrations = User.hasMany(MissionSlotRegistration, { as: 'missionSlotRegistrations', foreignKey: 'userUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    User.associations.missionSlotTemplates = User.hasMany(MissionSlotTemplate, { as: 'missionSlotTemplates', foreignKey: 'creatorUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    User.associations.notifications = User.hasMany(Notification, { as: 'notifications', foreignKey: 'userUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    User.associations.permissions = User.hasMany(Permission, { as: 'permissions', foreignKey: 'userUid', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
}
// tslint:enable:max-line-length

export default createAssociations;
