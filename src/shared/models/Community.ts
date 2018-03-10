import * as Boom from 'boom';
import * as Joi from 'joi';
import * as _ from 'lodash';
import * as moment from 'moment';
import {
    DataTypes,
    HasMany,
    HasManyAddAssociationMixin,
    HasManyCreateAssociationMixin,
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

import { missionRepositoryInfoSchema } from '../schemas/missionRepositoryInfo';
import { missionServerInfoSchema } from '../schemas/missionServerInfo';
import {
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_ACCEPTED,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DELETED,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DENIED,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_NEW,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_REMOVED,
    NOTIFICATION_TYPE_COMMUNITY_DELETED,
    NOTIFICATION_TYPE_COMMUNITY_PERMISSION_GRANTED,
    NOTIFICATION_TYPE_COMMUNITY_PERMISSION_REVOKED
} from '../types/notification';
import { CommunityApplication } from './CommunityApplication';
import { IMissionRepositoryInfo, IMissionServerInfo, IPublicMission, Mission } from './Mission';
import { MissionAccess } from './MissionAccess';
import { Notification } from './Notification';
import { Permission } from './Permission';
import { IPublicUser, User } from './User';

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
    paranoid: false
})
export class Community extends Model {
    /**
     * Associations of the community model
     *
     * @static
     * @type {{
     *         applications: HasMany
     *         members: HasMany,
     *         missionAccesses: HasMany,
     *         missions: HasMany,
     *         restrictedSlots: HasMany
     *     }}
     * @memberof Community
     */
    public static associations: {
        applications: HasMany;
        members: HasMany;
        missionAccesses: HasMany;
        missions: HasMany;
        restrictedSlots: HasMany;
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
        allowNull: false,
        validate: {
            notEmpty: true
        }
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
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public tag: string;

    /**
     * Website URL of the community.
     * Can be `null` if no website URL was provided
     *
     * @type {(string | null)}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true,
            isUrl: true
        }
    })
    public website: string | null;

    /**
     * Slug used for identifying a community in the frontend.
     * More user-friendly version of a UID, makes for prettier URLs
     *
     * @type {string}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true
        }
    })
    get slug(): string {
        return this.getDataValue('slug');
    }
    set slug(val: string) {
        if (val === 'slugAvailable') {
            throw Boom.badRequest('Disallowed slug');
        }

        this.setDataValue('slug', slug(val));
    }

    /**
     * Optional URL of logo to display on community details.
     * Can be `null` if not defined by community founder/leader
     *
     * @type {(string | null)}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true,
            isUrl: true
        }
    })
    public logoUrl: string | null;

    /**
     * Information about the gameservers run by the community. Can be used by mission creators to automatically fill out the mission's gameserver data.
     * Can be an empty array if no gameserver information is provided.
     *
     * @type {IMissionServerInfo[]}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        validate: {
            validMissionServerInfo(val: any): void {
                let localVal = val;
                if (!_.isArray(localVal)) {
                    localVal = [localVal];
                }

                const validationResult = Joi.validate(localVal, Joi.array().required().items(missionServerInfoSchema.optional()));
                if (!_.isNil(validationResult.error)) {
                    throw Boom.badRequest('Invalid mission server info', validationResult);
                }
            }
        }
    })
    public gameServers: IMissionServerInfo[];

    /**
     * Information about the voice comms servers run by the community. Can be used by mission creators to automatically fill out the mission's voice comms data.
     * Can be an empty array if no voice comm server information is provided.
     *
     * @type {IMissionServerInfo[]}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        validate: {
            validMissionServerInfo(val: any): void {
                let localVal = val;
                if (!_.isArray(localVal)) {
                    localVal = [localVal];
                }

                const validationResult = Joi.validate(localVal, Joi.array().required().items(missionServerInfoSchema.optional()));
                if (!_.isNil(validationResult.error)) {
                    throw Boom.badRequest('Invalid mission server info', validationResult);
                }
            }
        }
    })
    public voiceComms: IMissionServerInfo[];

    /**
     * Information about the mod repositories provided by the community. Can be used by mission creators to automatically fill out the mission's repository data.
     * Can be an empty array if no mod repository information is provided.
     *
     * @type {IMissionRepositoryInfo[]}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        validate: {
            validMissionRepositoryInfo(val: any): void {
                let localVal = val;
                if (!_.isArray(localVal)) {
                    localVal = [localVal];
                }

                const validationResult = Joi.validate(localVal, Joi.array().required().items(missionRepositoryInfoSchema.optional()));
                if (!_.isNil(validationResult.error)) {
                    throw Boom.badRequest('Invalid mission repository info', validationResult);
                }
            }
        }
    })
    public repositories: IMissionRepositoryInfo[];

    /**
     * Eager-loaded list of member applications associated with the community.
     * Only included if the community has applications associated and it has been eager-loaded via sequelize
     *
     * @type {(CommunityApplication[] | undefined)}
     * @memberof Community
     */
    public applications?: CommunityApplication[];

    /**
     * Eager-loaded list of members/users associated with the community.
     * Only included if the community has users associated and it has been eager-loaded via sequelize
     *
     * @type {(User[] | undefined)}
     * @memberof Community
     */
    public members?: User[];

    /**
     * Eager-loaded list mission accesses granted to the community.
     * Only included if the community has accesses granted and it has been eager-loaded via sequelize
     *
     * @type {(MissionAccess[] | undefined)}
     * @memberof Community
     */
    public missionAccesses?: MissionAccess[];

    /**
     * Eager-loaded list missions associated with the community.
     * Only included if the community has missions associated and it has been eager-loaded via sequelize
     *
     * @type {(Mission[] | undefined)}
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
     * Creates a new application for the current community
     *
     * @type {HasManyCreateAssociationMixin<CommunityApplication>}
     * @returns {Promise<CommunityApplication>} Community application created
     * @memberof Community
     */
    public createApplication: HasManyCreateAssociationMixin<CommunityApplication>;

    /**
     * Retrieves the community's application instances.
     * Returns an empty array if the community has no applications assigned
     *
     * @type {HasManyGetAssociationsMixin<CommunityApplication>}
     * @returns {Promise<CommunityApplication[]>} List of community applications
     * @memberof Community
     */
    public getApplications: HasManyGetAssociationsMixin<CommunityApplication>;

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
     * Retrieves the community's mission access instances.
     * Returns an empty array if the community has not been granted any mission access
     *
     * @type {HasManyGetAssociationsMixin<MissionAccess>}
     * @returns {Promise<MissionAccess[]>} List of mission accesses
     * @memberof Community
     */
    public getMissionAccesses: HasManyGetAssociationsMixin<MissionAccess>;

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
     * @param {boolean} [founder=false] Indicates whether the user should be added as a leader (false) or founder (true)
     * @returns {Promise<void>} Promise fulfilled when association is completed
     * @memberof Community
     */
    public async addLeader(userOrUserUid: User | string, founder: boolean = false): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findById(userOrUserUid);
            if (_.isNil(u)) {
                log.warn({ function: 'addLeader', communityUid: this.uid, userUid: userOrUserUid, founder }, 'Cannot add leader to community, user not found');
                throw Boom.notFound('User not found', { communityUid: this.uid, userUid: userOrUserUid, founder });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        log.debug({ function: 'addLeader', communityUid: this.uid, userUid: user.uid, founder }, 'Adding leader to community');

        await this.addMember(user);
        const permission = await user.createPermission({ permission: `community.${this.slug}.${founder ? 'founder' : 'leader'}` });

        log.debug({ function: 'addLeader', communityUid: this.uid, userUid: user.uid, founder, permissionUid: permission.uid }, 'Successfully added leader to community');
    }

    /**
     * Creates a notification for a community application deleted by the provided user for all users with recruitment permissions in the community
     *
     * @param {(User | string)} userOrUserUid User or user UID that deleted the application´
     * @returns {Promise<void>} Promise fulfilled when notifications have been created
     * @memberof Community
     */
    public async createApplicationDeletedNotifications(userOrUserUid: User | string): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findById(userOrUserUid);
            if (_.isNil(u)) {
                log.warn(
                    { function: 'createApplicationDeletedNotification', communityUid: this.uid, userUid: userOrUserUid },
                    'Cannot create application submitted notifications for community, user not found');
                throw Boom.notFound('User not found', { communityUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        log.debug({ function: 'createApplicationDeletedNotification', communityUid: this.uid, userUid: user.uid }, 'Creating application deleted notifications for community');

        const recruitmentPermissions = await Permission.findAll({
            where: {
                permission: {
                    $or: [`community.${this.slug}.founder`, `community.${this.slug}.leader`, `community.${this.slug}.recruitment`]
                }
            }
        });

        const userUids = _.uniq(_.map(recruitmentPermissions, 'userUid'));

        const notifications = await Promise.map(userUids, (userUid: string) => {
            return Notification.create({
                userUid,
                notificationType: NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DELETED,
                data: {
                    communitySlug: this.slug,
                    communityName: this.name,
                    userUid: user.uid,
                    userNickname: user.nickname
                }
            });
        });

        log.debug(
            { function: 'createApplicationDeletedNotification', communityUid: this.uid, userUid: user.uid, notificationUids: _.map(notifications, 'uid') },
            'Successfully created application submitted notifications for community');
    }

    /**
     * Creates a notification for community application by the provided user that was either accepted or denied
     *
     * @param {(User | string)} userOrUserUid User or user UID that applied to the community
     * @param {boolean} accepted Indicates whether the application was accepted or denied
     * @returns {Promise<void>} Promise fulfilled when notification has been created
     * @memberof Community
     */
    public async createApplicationProcessedNotification(userOrUserUid: User | string, accepted: boolean): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findById(userOrUserUid);
            if (_.isNil(u)) {
                log.warn(
                    { function: 'createApplicationProcessedNotification', communityUid: this.uid, userUid: userOrUserUid },
                    'Cannot create application processed notification for community, user not found');
                throw Boom.notFound('User not found', { communityUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        log.debug({ function: 'createApplicationProcessedNotification', communityUid: this.uid, userUid: user.uid }, 'Creating application processed notification for community');

        const notification = await Notification.create({
            userUid: user.uid,
            notificationType: accepted ? NOTIFICATION_TYPE_COMMUNITY_APPLICATION_ACCEPTED : NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DENIED,
            data: {
                communitySlug: this.slug,
                communityName: this.name,
                userUid: user.uid,
                userNickname: user.nickname
            }
        });

        log.debug(
            { function: 'createApplicationProcessedNotification', communityUid: this.uid, userUid: user.uid, notificationUid: notification.uid },
            'Successfully created application processed notification for community');
    }

    /**
     * Creates a notification for a user that has had their community application (and thus their member) status removed from a community
     *
     * @param {(User | string)} userOrUserUid User or user UID that has been removed
     * @returns {Promise<void>} Promise fulfilled when notification has been created
     * @memberof Community
     */
    public async createApplicationRemovedNotification(userOrUserUid: User | string): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findById(userOrUserUid);
            if (_.isNil(u)) {
                log.warn(
                    { function: 'createApplicationRemovedNotification', communityUid: this.uid, userUid: userOrUserUid },
                    'Cannot create application removed notification for community, user not found');
                throw Boom.notFound('User not found', { communityUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        log.debug({ function: 'createApplicationRemovedNotification', communityUid: this.uid, userUid: user.uid }, 'Creating application removed notification for community');

        const notification = await Notification.create({
            userUid: user.uid,
            notificationType: NOTIFICATION_TYPE_COMMUNITY_APPLICATION_REMOVED,
            data: {
                communitySlug: this.slug,
                communityName: this.name,
                userUid: user.uid,
                userNickname: user.nickname
            }
        });

        log.debug(
            { function: 'createApplicationRemovedNotification', communityUid: this.uid, userUid: user.uid, notificationUid: notification.uid },
            'Successfully created application removed notification for community');
    }

    /**
     * Creates a notification for a new community application submitted by the provided user for all users with recruitment permissions in the community
     *
     * @param {(User | string)} userOrUserUid User or user UID that applied to the community
     * @returns {Promise<void>} Promise fulfilled when notifications have been created
     * @memberof Community
     */
    public async createApplicationSubmittedNotifications(userOrUserUid: User | string): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findById(userOrUserUid);
            if (_.isNil(u)) {
                log.warn(
                    { function: 'createApplicationSubmittedNotifications', communityUid: this.uid, userUid: userOrUserUid },
                    'Cannot create application submitted notifications for community, user not found');
                throw Boom.notFound('User not found', { communityUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        log.debug({ function: 'createApplicationSubmittedNotifications', communityUid: this.uid, userUid: user.uid }, 'Creating application submitted notifications for community');

        const recruitmentPermissions = await Permission.findAll({
            where: {
                permission: {
                    $or: [`community.${this.slug}.founder`, `community.${this.slug}.leader`, `community.${this.slug}.recruitment`]
                }
            }
        });

        const userUids = _.uniq(_.map(recruitmentPermissions, 'userUid'));

        const notifications = await Promise.map(userUids, (userUid: string) => {
            return Notification.create({
                userUid,
                notificationType: NOTIFICATION_TYPE_COMMUNITY_APPLICATION_NEW,
                data: {
                    communitySlug: this.slug,
                    communityName: this.name,
                    userUid: user.uid,
                    userNickname: user.nickname
                }
            });
        });

        log.debug(
            { function: 'createApplicationSubmittedNotifications', communityUid: this.uid, userUid: user.uid, notificationUids: _.map(notifications, 'uid') },
            'Successfully created application submitted notifications for community');
    }

    /**
     * Creates a notification when a community has been deleted, notifying all members
     *
     * @returns {Promise<void>} Promise fulfilled when notifications have been created
     * @memberof Community
     */
    public async createCommunityDeletedNotifications(): Promise<void> {
        log.debug({ function: 'createCommunityDeletedNotifications', communityUid: this.uid }, 'Creating deleted notifications for community');

        const members = await User.findAll({ where: { communityUid: this.uid }, attributes: ['uid'] });

        const userUids = _.uniq(_.map(members, 'uid'));

        const notifications = await Promise.map(userUids, (userUid: string) => {
            return Notification.create({
                userUid,
                notificationType: NOTIFICATION_TYPE_COMMUNITY_DELETED,
                data: {
                    communitySlug: this.slug,
                    communityName: this.name
                }
            });
        });

        log.debug(
            { function: 'createCommunityDeletedNotifications', communityUid: this.uid, notificationUids: _.map(notifications, 'uid') },
            'Successfully created deleted notifications for community');
    }

    /**
     * Creates a notification for a community permission that was either granted or revoked for a user
     *
     * @param {(User | string)} userOrUserUid User or user UID that had the permission granted or revoked
     * @param {string} permission Permission that was granted or revoked
     * @param {boolean} granted Indicates whether the permission was granted or revoked
     * @returns {Promise<void>} Promise fulfilled when notification has been created
     * @memberof Community
     */
    public async createPermissionNotification(userOrUserUid: User | string, permission: string, granted: boolean): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findById(userOrUserUid);
            if (_.isNil(u)) {
                log.warn(
                    { function: 'createPermissionNotification', communityUid: this.uid, userUid: userOrUserUid },
                    'Cannot create permission notification for community, user not found');
                throw Boom.notFound('User not found', { communityUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        log.debug({ function: 'createPermissionNotification', communityUid: this.uid, userUid: user.uid }, 'Creating permission notification for community');

        const notification = await Notification.create({
            userUid: user.uid,
            notificationType: granted ? NOTIFICATION_TYPE_COMMUNITY_PERMISSION_GRANTED : NOTIFICATION_TYPE_COMMUNITY_PERMISSION_REVOKED,
            data: {
                permission,
                communitySlug: this.slug,
                communityName: this.name
            }
        });

        log.debug(
            { function: 'createPermissionNotification', communityUid: this.uid, userUid: user.uid, notificationUid: notification.uid },
            'Successfully created permission notification for community');
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
     * Removes the given user or a user with the provided UID from the community's leaders.
     * This only removes the `community.${community.slug}.leader` or `community.${community.slug}.founder` permission, but leaves `community.${community.slug}.*` intact
     *
     * @param {(User | string)} userOrUserUid User instance or UID of user to remove
     * @param {boolean} [founder=false] Indicates whether the user to remove was a leader (false) or founder (true)
     * @returns {Promise<void>} Promise fulfilled when removal is completed
     * @memberof Community
     */
    public async removeLeader(userOrUserUid: User | string, founder: boolean = false): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findById(userOrUserUid);
            if (_.isNil(u)) {
                log.warn({ function: 'removeLeader', communityUid: this.uid, userUid: userOrUserUid, founder }, 'Cannot remove leader from community, user not found');
                throw Boom.notFound('User not found', { communityUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        log.debug({ function: 'removeLeader', communityUid: this.uid, userUid: user.uid, founder }, 'Removing leader from community');

        await user.removePermissionByPermissionString(`community.${this.uid}.${founder ? 'founder' : 'leader'}`);

        log.debug({ function: 'removeLeader', communityUid: this.uid, userUid: user.uid, founder }, 'Successfully removed leader from community');
    }

    /**
     * Returns a public representation of the community instance, as transmitted via API
     *
     * @returns {Promise<IPublicCommunity>} Object containing public community information
     * @memberof Community
     */
    public async toPublicObject(): Promise<IPublicCommunity> {
        return {
            uid: this.uid,
            name: this.name,
            tag: this.tag,
            website: _.isNil(this.website) ? null : this.website,
            slug: this.slug,
            logoUrl: this.logoUrl
        };
    }

    /**
     * Returns a detailed public representation of the community instance, as transmitted via API.
     * Also includes leaders, members and missions created by members
     *
     * @param {boolean} includeFullDetails Indicates whether full community details should be included, returned for community members and admins
     * @returns {Promise<IDetailedPublicCommunity>} Object containing detailed public community information
     * @memberof Community
     */
    public async toDetailedPublicObject(includeFullDetails: boolean = false): Promise<IDetailedPublicCommunity> {
        const leaders = await this.getLeaders();

        if (_.isNil(this.members)) {
            this.members = await this.getMembers();
        }

        if (_.isNil(this.missions)) {
            this.missions = await this.getMissions({
                where: {
                    endTime: {
                        $gt: moment.utc()
                    }
                }
            });
        }

        const [publicLeaders, publicMembers, publicMissions] = await Promise.all([
            Promise.map(leaders, (leader: User) => {
                return leader.toPublicObject();
            }),
            Promise.map(this.members, (member: User) => {
                return member.toPublicObject();
            }),
            Promise.map(this.missions, (mission: Mission) => {
                return mission.toPublicObject();
            })
        ]);

        return {
            uid: this.uid,
            name: this.name,
            tag: this.tag,
            website: _.isNil(this.website) ? null : this.website,
            slug: this.slug,
            logoUrl: this.logoUrl,
            leaders: publicLeaders,
            members: _.pullAllBy(publicMembers, publicLeaders, 'uid'),
            missions: publicMissions,
            gameServers: includeFullDetails ? this.gameServers : undefined,
            voiceComms: includeFullDetails ? this.voiceComms : undefined,
            repositories: includeFullDetails ? this.repositories : undefined
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
    name: string;
    tag: string;
    website: string | null;
    slug: string;
    logoUrl: string | null;
}

/**
 * Detailed public community information as transmitted via API.
 * Also includes leaders, members and missions created by members
 *
 * @export
 * @interface IDetailedPublicCommunity
 * @extends {IPublicCommunity}
 */
export interface IDetailedPublicCommunity extends IPublicCommunity {
    leaders: IPublicUser[];
    members: IPublicUser[];
    missions: IPublicMission[];
    gameServers?: IMissionServerInfo[];
    voiceComms?: IMissionServerInfo[];
    repositories?: IMissionRepositoryInfo[];
}
