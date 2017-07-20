import * as Boom from 'boom';
import * as _ from 'lodash';
import {
    DataTypes,
    HasMany,
    HasManyAddAssociationMixin,
    HasManyGetAssociationsMixin,
    HasManyHasAssociationMixin,
    HasManyRemoveAssociationMixin,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import { log as logger } from '../util/log';
import sequelize from '../util/sequelize';
import slug from '../util/slug';
const log = logger.child({ model: 'Community' });

/**
 * Represents a community in database.
 * Provides database access and utility functionality for community instances
 *
 * @export
 * @class Community
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'communities',
    paranoid: true
})
export class Community extends Model {
    /**
     * Associations of the community model
     *
     * @static
     * @type {{
     *         members: HasMany,
     *         missions: HasMany
     *     }}
     * @memberof Community
     */
    public static associations: {
        members: HasMany,
        missions: HasMany
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the community in the database
     *
     * @type {string}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Name of the community
     *
     * @type {string}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false
    })
    public name: string;

    /**
     * Tag of the community
     *
     * @type {string}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false
    })
    public tag: string;

    /**
     * Website URL of the community
     * Can be `undefined|null` if no website URL was provided
     *
     * @type {string}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: true
    })
    public website: string;

    /**
     * Slug used for identifying a community in the frontend
     * More user-friendly version of a UID, makes for prettier URLs
     *
     * @type {string}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    })
    get slug(): string {
        return this.getDataValue('slug');
    }
    set slug(val: string) {
        this.setDataValue('slug', slug(val));
    }

    /**
     * Eager-loaded list of members/users associated with the community
     * Only included if the community has users associated and it has been eager-loaded via sequelize
     *
     * @type {User[]|undefined}
     * @memberof Community
     */
    public members?: User[];

    /**
     * Eager-loaded list missions associated with the community
     * Only included if the community has missions associated and it has been eager-loaded via sequelize
     *
     * @type {Mission[]|undefined}
     * @memberof Community
     */
    public missions?: Mission[];

    /**
     * Time (and date) the community instance was created
     *
     * @type {Date}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the community instance was last updated
     *
     * @type {Date}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public updatedAt: Date;

    /**
     * Time (and date) the community instance was deleted
     * Will only be set once the community has been deleted, caused by paranoid table settings
     * Can be `undefined|null` until the community instance deletion
     *
     * @type {Date|undefined|null}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    })
    public deletedAt?: Date;

    ////////////////////////////
    // Sequelize model mixins //
    ////////////////////////////

    /**
     * Adds the given user or user with the provided UID to the community's list of members
     *
     * @type {HasManyAddAssociationMixin<User, string>}
     * @returns {Promise<void>} Promise fulfilled when association is completed
     * @memberof Community
     */
    public addMember: HasManyAddAssociationMixin<User, string>;

    /**
     * Retrieves the community's member instances.
     * Returns an empty array if the community has no users assigned
     *
     * @type {HasManyGetAssociationsMixin<User>}
     * @returns {Promise<User[]>} List of community members
     * @memberof Community
     */
    public getMembers: HasManyGetAssociationsMixin<User>;

    /**
     * Retrieves the community's mission instances.
     * Returns an empty array if the community has no missions assigned
     *
     * @type {HasManyGetAssociationsMixin<Mission>}
     * @returns {Promise<Mission[]>} List of missions
     * @memberof Community
     */
    public getMissions: HasManyGetAssociationsMixin<Mission>;

    /**
     * Checks whether the community has a member with the provided UID
     *
     * @type {HasManyHasAssociationMixin<User, string>}
     * @returns {Promise<boolean>} Indicates whether the user was found
     * @memberof Community
     */
    public hasMember: HasManyHasAssociationMixin<User, string>;

    /**
     * Checks whether the community has a mission with the provided UID
     *
     * @type {HasManyHasAssociationMixin<Mission, string>}
     * @returns {Promise<boolean>} Indicates whether the mission was found
     * @memberof Community
     */
    public hasMission: HasManyHasAssociationMixin<Mission, string>;

    /**
     * Removes the given user or a user with the provided UID from the community's member list
     *
     * @type {HasManyRemoveAssociationMixin<User, string>}
     * @returns {Promise<void>} Promise fulfilled when removal is completed
     * @memberof Community
     */
    public removeMember: HasManyRemoveAssociationMixin<User, string>;

    /**
     * Removes the given mission or a mission with the provided UID from the community
     *
     * @type {HasManyRemoveAssociationMixin<Mission, string>}
     * @returns {Promise<void>} Promise fulfilled when removal is completed
     * @memberof Community
     */
    public removeMission: HasManyRemoveAssociationMixin<User, string>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    /**
     * Checks whether the given slug is available for new communities
     *
     * @static
     * @param {string} newSlug Slug (can be unescaped) to check for
     * @returns {Promise<boolean>} Indicates whether the slug is available
     * @memberof Community
     */
    // tslint:disable-next-line:function-name
    public static async isSlugAvailable(newSlug: string): Promise<boolean> {
        log.debug({ function: 'isSlugAvailable', newSlug }, 'Checking if community slug is available');

        const community = await this.findOne({
            where: { slug: slug(newSlug) },
            attributes: ['uid']
        });

        const isSlugAvailable = _.isNil(community);

        log.debug({ function: 'isSlugAvailable', newSlug, isSlugAvailable }, 'Successfully finished checking if community slug is available');

        return isSlugAvailable;
    }

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Adds the given user or user with the provided UID as a community leader.
     * This will set the `community.${community.slug}.leader` permission as well as add the user to the community's member list (if they were not added before)
     *
     * @param {(User | string)} userOrUserUid User or user UID to add as a community leader
     * @returns {Promise<void>} Promise fulfilled when association is completed
     * @memberof Community
     */
    public async addLeader(userOrUserUid: User | string): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findOne(userOrUserUid);
            if (_.isNil(u)) {
                log.warn({ function: 'addLeader', communityUid: this.uid, userUid: userOrUserUid }, 'Cannot add leader to community, user not found');
                throw Boom.notFound('User not found', { communityUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        log.debug({ function: 'addLeader', communityUid: this.uid, userUid: user.uid }, 'Adding leader to community');

        if (!await this.hasMember(user)) {
            log.debug({ function: 'addLeader', communityUid: this.uid, userUid: user.uid }, 'Community does not have leader member yet, adding');

            await this.addMember(user);
        }

        const permission = await user.createPermission({ permission: `community.${this.slug}.leader` });

        log.debug({ function: 'addLeader', communityUid: this.uid, userUid: user.uid, permissionUid: permission.uid }, 'Successfully added leader to community');
    }

    /**
     * Retrieves the community's list of members with leadership permissions
     *
     * @returns {Promise<User[]>} List of community leaders including founds
     * @memberof Community
     */
    public async getLeaders(): Promise<User[]> {
        log.debug({ function: 'getLeaders', communityUid: this.uid }, 'Retrieving leaders for community');

        const leaders = await User.findAll({
            include: [
                {
                    model: Permission,
                    as: 'permissions',
                    where: {
                        permission: {
                            $or: [`community.${this.slug}.*`, `community.${this.slug}.founder`, `community.${this.slug}.leader`]
                        }
                    }
                }
            ]
        });

        log.debug(
            { function: 'getLeaders', communityUid: this.uid, leaderUids: _.map(leaders, 'uid'), leaderCount: leaders.length },
            'Successfully retrieved leaders for community');

        return leaders;
    }

    /**
     * Checks whether the community has the given user or a user with the provided UID as a leader or founder
     *
     * @param {(User | string)} userOrUserUid User instance or UID of user to check for
     * @returns {Promise<boolean>} Indicates whether the leader was found
     * @memberof Community
     */
    public async hasLeader(userOrUserUid: User | string): Promise<boolean> {
        let userUid: string;
        if (_.isString(userOrUserUid)) {
            userUid = userOrUserUid;
        } else {
            userUid = userOrUserUid.uid;
        }

        log.debug({ function: 'hasLeader', communityUid: this.uid, userUid: userUid }, 'Checking if community has leader');

        const user = await User.findById(userUid, {
            attributes: ['uid'],
            include: [
                {
                    model: Permission,
                    as: 'permissions',
                    where: {
                        permission: {
                            $or: [`community.${this.slug}.*`, `community.${this.slug}.founder`, `community.${this.slug}.leader`]
                        }
                    }
                }
            ]
        });

        const hasLeader = !_.isNil(user);

        log.debug({ function: 'hasLeader', communityUid: this.uid, userUid: userUid, hasLeader }, 'Successfully finished checking if community has leader');

        return hasLeader;
    }

    /**
     * Removes the given user or a user with the provided UID from the community's leaders
     * This only removes the `community.${community.slug}.leader` permission, but leave `community.${community.slug}.*` or `community.${community.slug}.founder` intact
     *
     * @param {(User | string)} userOrUserUid User instance or UID of user to remove
     * @returns {Promise<void>} Promise fulfilled when removal is completed
     * @memberof Community
     */
    public async removeLeader(userOrUserUid: User | string): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findOne(userOrUserUid);
            if (_.isNil(u)) {
                log.warn({ function: 'removeLeader', communityUid: this.uid, userUid: userOrUserUid }, 'Cannot remove leader from community, user not found');
                throw Boom.notFound('User not found', { communityUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        log.debug({ function: 'removeLeader', communityUid: this.uid, userUid: user.uid }, 'Removing leader from community');

        await user.removePermissionByPermissionString(`community.${this.uid}.leader`);

        log.debug({ function: 'removeLeader', communityUid: this.uid, userUid: user.uid }, 'Successfully removed leader from community');
    }

    /**
     * Returns a public representation of the community instance, as transmitted via API
     *
     * @returns {Promise<IPublicCommunity>} Object containing public community information
     * @memberof Community
     */
    public async toPublicObject(): Promise<IPublicCommunity> {
        return {
            uid: this.uid
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public community information as transmitted via API
 *
 * @export
 * @interface IPublicCommunity
 */
export interface IPublicCommunity {
    uid: string;
}

/**
 * Model associations
 *
 * ATTENTION: absolutely **HAS** to be at the very end of the file and **AFTER** complete model definition, causes cyclic dependency hell otherwise.
 * Imports of associated models **MUST NOT** be at the top of the file, but rather **HAVE TO BE** down here
 */

import { Mission } from './Mission';
import { Permission } from './Permission';
import { User } from './User';

Community.associations.members = Mission.hasMany(User, { as: 'members', foreignKey: 'communityUid' });
Community.associations.missions = Mission.hasMany(User, { as: 'missions', foreignKey: 'communityUid' });
