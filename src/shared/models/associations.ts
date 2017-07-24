import { Community } from './Community';
import { Mission } from './Mission';
import { Permission } from './Permission';
import { User } from './User';

/**
 * Creates association between sequelize models.
 * This gets executed after all models have been created so circular references work properly
 *
 * @export
 */
export function createAssociations(): void {
    Community.associations.members = Mission.hasMany(User, { as: 'members', foreignKey: 'communityUid' });
    Community.associations.missions = Mission.hasMany(Mission, { as: 'missions', foreignKey: 'communityUid' });

    Mission.associations.community = Mission.belongsTo(Community, { as: 'community', foreignKey: 'communityUid' });
    Mission.associations.creator = Mission.belongsTo(User, { as: 'creator', foreignKey: 'creatorUid' });

    Permission.associations.user = Permission.belongsTo(User, { as: 'user', foreignKey: 'userUid' });

    User.associations.community = User.belongsTo(Community, { as: 'community', foreignKey: 'communityUid' });
    User.associations.missions = User.hasMany(Mission, { as: 'missions', foreignKey: 'creatorUid' });
    User.associations.permissions = User.hasMany(Permission, { as: 'permissions', foreignKey: 'userUid' });
}

export default createAssociations;
