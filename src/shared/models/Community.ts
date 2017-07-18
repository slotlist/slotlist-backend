import * as Boom from 'boom';
import * as _ from 'lodash';
import * as Sequelize from 'sequelize';

import Storage, { IDefaultParanoidModelAttributes, IModels } from '../services/Storage';
import { log as logger } from '../util/log';
const log = logger.child({ model: 'Community' });
import slug from '../util/slug';

import { IMission, IMissionPrimaryKey } from './Mission';
import { IUser, IUserPrimaryKey } from './User';

export type ICommunityPrimaryKey = string;

export interface ICommunityAttributes extends IDefaultParanoidModelAttributes {
    uid: ICommunityPrimaryKey;
    name: string;
    tag: string;
    website: string;
    slug: string;
}

export interface IPublicCommunityAttributes {
    uid: ICommunityPrimaryKey;
    name: string;
    tag: string;
    website: string;
}
export type IPublicCommunity = IPublicCommunityAttributes;

export interface ICommunityInstance extends Sequelize.Instance<ICommunityAttributes>, ICommunityAttributes {
    addMember: Sequelize.HasManyAddAssociationMixin<IUser, IUserPrimaryKey>;
    addMission: Sequelize.HasManyAddAssociationMixin<IMission, IMissionPrimaryKey>;
    getMembers: Sequelize.HasManyGetAssociationsMixin<IUser>;
    getMissions: Sequelize.HasManyGetAssociationsMixin<IMission>;
    hasMember: Sequelize.HasManyHasAssociationMixin<IUser, IUserPrimaryKey>;
    hasMission: Sequelize.HasManyHasAssociationMixin<IMission, IMissionPrimaryKey>;
    removeMember: Sequelize.HasManyRemoveAssociationMixin<IUser, IUserPrimaryKey>;
    removeMission: Sequelize.HasManyRemoveAssociationMixin<IMission, IMissionPrimaryKey>;

    addLeader(userUid: string): Promise<void>;
    getLeaders(): Promise<IUser[]>;
    hasLeader(userUid: string): Promise<boolean>;
    removeLeader(): Promise<void>;

    toPublicObject(): Promise<IPublicCommunity>;
}
export type ICommunity = ICommunityInstance;

// tslint:disable-next-line:no-empty-interface
export interface ICommunityModel extends Sequelize.Model<ICommunityInstance, Partial<ICommunityAttributes>> {

}

type ICommunityAssociations = {
    Members: any,
    Missions: any
};

// tslint:disable-next-line:prefer-const
let associations: ICommunityAssociations;

export function getAssociations(): ICommunityAssociations {
    return associations;
}

/**
 * Sequelize model representing a Community
 *
 * @export
 * @param {Sequelize.Sequelize} sequelize Sequelize instance
 */
export default function createCommunityModel(sequelize: Sequelize.Sequelize): Sequelize.Model<ICommunityInstance, ICommunityAttributes> {
    // tslint:disable
    const Community: any = sequelize.define<ICommunityInstance, ICommunityAttributes>('community', {
        uid: {
            type: Sequelize.UUID,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        tag: {
            type: Sequelize.STRING,
            allowNull: false
        },
        website: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: null
        },
        slug: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
            set(val: any) {
                if (!_.isString(val)) {
                    throw new Error('Community slug must be a string');
                }

                (<any>this).setDataValue('slug', slug(val));
            }
        }
    }, {
            paranoid: true
        });

    // Class methods
    Community.associate = function (models: IModels): void {
        associations = {
            Members: Community.hasMany(models.User, {
                as: 'members',
                foreignKey: 'communityUid'
            }),
            Missions: Community.hasMany(models.Mission, {
                as: 'missions',
                foreignKey: 'communityUid'
            })
        }
    }

    // Instance methods
    Community.prototype.addLeader = async function (userUid: string): Promise<void> {
        const instance: ICommunity = this;

        log.debug({ function: 'addLeader', communityUid: instance.uid, userUid }, 'Adding leader to community');

        const permission = await Storage.models.Permission.create({ userUid: userUid, permission: `community.${instance.slug}.leader` });

        log.debug({ function: 'addLeader', communityUid: instance.uid, userUid, permissionUid: permission.uid }, 'Successfully added leader to community');
    }

    Community.prototype.getLeaders = async function (): Promise<IUser[]> {
        const instance: ICommunity = this;

        log.debug({ function: 'getLeaders', communityUid: instance.uid }, 'Retrieving leaders for community');

        const leaders: IUser[] = await Storage.models.User.findAll({
            include: [
                {
                    model: Storage.models.Permission,
                    as: 'Permissions',
                    where: {
                        permission: {
                            $or: [`community.${instance.slug}.*`, `community.${instance.slug}.leader`]
                        }
                    }
                }
            ]
        })

        log.debug({ function: 'getLeaders', communityUid: instance.uid, leaderUids: _.map(leaders, 'uid'), leaderCount: leaders.length }, 'Successfully retrieved leaders for community');

        return leaders;
    }

    Community.prototype.hasLeader = async function (userUid: string): Promise<boolean> {
        const instance: ICommunity = this;

        const count = await Storage.models.Permission.count({
            where: {
                permission: `community.${instance.slug}.leader`,
                UserUid: userUid
            }
        });

        return count >= 1;
    }

    Community.prototype.removeLeader = async function (userUid: string): Promise<void> {
        const instance: ICommunity = this;

        log.debug({ function: 'removeLeader', communityUid: instance.uid, userUid }, 'Removing leader from community');

        const destroyed = await Storage.models.Permission.destroy({
            where: {
                permission: `community.${instance.slug}.leader`,
                UserUid: userUid
            }
        })

        if (destroyed <= 0) {
            log.warn({ function: 'removeLeader', communityUid: instance.uid, userUid }, 'Failed to remove leader from community, not found');
            throw Boom.notFound('Community leader not found');
        }

        log.debug({ function: 'removeLeader', communityUid: instance.uid, userUid, destroyed }, 'Successfully removed leader from community');
    }

    Community.prototype.toPublicObject = async function (): Promise<IPublicCommunity> {
        const instance: ICommunity = this;

        return {
            uid: instance.uid,
            name: instance.name,
            tag: instance.tag,
            website: instance.website
        }
    }

    // tslint:enable
    return Community;
}
