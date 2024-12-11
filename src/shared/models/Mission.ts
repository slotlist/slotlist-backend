import * as Boom from 'boom';
import * as Joi from 'joi';
import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    HasMany,
    HasManyCreateAssociationMixin,
    HasManyGetAssociationsMixin,
    HasManyRemoveAssociationMixin,
    literal,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';
import * as uuid from 'uuid';

import { log as logger } from '../util/log';
import sequelize from '../util/sequelize';
import slug from '../util/slug';
const log = logger.child({ model: 'Community' });

import { missionRepositoryInfoSchema } from '../schemas/missionRepositoryInfo';
import { missionServerInfoSchema } from '../schemas/missionServerInfo';
import {
    NOTIFICATION_TYPE_MISSION_DELETED,
    NOTIFICATION_TYPE_MISSION_PERMISSION_GRANTED,
    NOTIFICATION_TYPE_MISSION_PERMISSION_REVOKED,
    NOTIFICATION_TYPE_MISSION_SLOT_ASSIGNED,
    NOTIFICATION_TYPE_MISSION_SLOT_REGISTRATION_NEW,
    NOTIFICATION_TYPE_MISSION_SLOT_UNASSIGNED,
    NOTIFICATION_TYPE_MISSION_SLOT_UNREGISTERED,
    NOTIFICATION_TYPE_MISSION_UPDATED
} from '../types/notification';
import { Community, IPublicCommunity } from './Community';
import { MissionAccess } from './MissionAccess';
import { IMissionSlotCreatePayload, MissionSlot } from './MissionSlot';
import { MissionSlotGroup } from './MissionSlotGroup';
import { MissionSlotRegistration } from './MissionSlotRegistration';
import { Notification } from './Notification';
import { Permission } from './Permission';
import { IPublicUser, User } from './User';

/**
 * Missions with `community` visibility are visible to members of the mission creator's community
 */
export const MISSION_VISIBILITY_COMMUNITY = 'community';
/**
 * Missions with `hidden` visibility are only visible to the mission creator and assigned mission editors
 */
export const MISSION_VISIBILITY_HIDDEN = 'hidden';
/**
 * Missions with `private` visibility are only visible to selected users as chosen by the mission creator (not implemented as of 2017-08-23)
 */
export const MISSION_VISIBILITY_PRIVATE = 'private';
/**
 * Missions with `public` visibility are visible to every user
 */
export const MISSION_VISIBILITY_PUBLIC = 'public';
/**
 * List of possible `visibility` settings for a mission, defining which users can view it
 */
export const MISSION_VISIBILITIES = [
    MISSION_VISIBILITY_COMMUNITY,
    MISSION_VISIBILITY_HIDDEN,
    MISSION_VISIBILITY_PRIVATE,
    MISSION_VISIBILITY_PUBLIC
];

/**
 * List of possiblie `requiredDLC` settings for a mission
 *
 */
export const MISSION_REQUIRED_DLCS = [
    'aow',
    'apex',
    'contact',
    'csla',
    'ef',
    'gm',
    'helicopters',
    'jets',
    'karts',
    'laws-of-war',
    'marksmen',
    'rf',
    'tac-ops',
    'tanks',
    'vn'
];

/**
 * Represents a mission in database.
 * Provides database access and utility functionality for mission instances
 *
 * @export
 * @class Mission
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'missions',
    paranoid: false
})
export class Mission extends Model {
    /**
     * Associations of the mission model
     *
     * @static
     * @type {{
     *         community: BelongsTo,
     *         creator: BelongsTo,
     *         missionAccesses: HasMany,
     *         slotGroups: HasMany
     *     }}
     * @memberof Mission
     */
    public static associations: {
        community: BelongsTo;
        creator: BelongsTo;
        missionAccesses: HasMany;
        slotGroups: HasMany;
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the mission in the database
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Title of the mission
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public title: string;

    /**
     * Slug used for identifying a mission in the frontend.
     * More user-friendly version of a UID, makes for prettier URLs
     *
     * @type {string}
     * @memberof Mission
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
     * (Detailed) description of the mission.
     * Will be added as HTML in frontend, thus allows for regular HTML styling
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public detailedDescription: string;

    /**
     * (Optional) collapsed description of the mission.
     * Will be added as HTML in frontend, thus allows for regular HTML styling
     *
     * @type {(string | null)}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true
        }
    })
    public collapsedDescription: string;

    /**
     * (Short) summary description of the mission.
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public description: string;

    /**
     * Optional URL of banner image to display on mission details.
     * Can be `null` if not defined by mission creator/editor
     *
     * @type {(string | null)}
     * @memberof Mission
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
    public bannerImageUrl: string | null;

    /**
     * Time (and date) the mission briefing starts.
     * The mission briefing is mainly intended for players in leadership roles
     *
     * @type {Date}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false
    })
    public briefingTime: Date;

    /**
     * Time (and date) the slotting starts.
     * Slotting usually starts a little bit before the actual mission start to allow for faster transition
     *
     * @type {Date}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false
    })
    public slottingTime: Date;

    /**
     * Time (and date) the mission starts.
     * Must be after or equal to slotting time
     *
     * @type {Date}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
            afterSlottingTime(val: Date): void {
                if (val < this.slottingTime) {
                    throw new Error('Mission startTime must be after slottingTime');
                }
            }
        }
    })
    public startTime: Date;

    /**
     * Time (and date) the mission is scheduled to end.
     * This time is only an estimate by the mission creator, actual time might differ.
     * Must be after or equal to start time
     *
     * @type {Date}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
            afterStartTime(val: Date): void {
                if (val < this.startTime) {
                    throw new Error('Mission endTime must be after startTime');
                }
            }
        }
    })
    public endTime: Date;

    /**
     * Information about tech support provided before the mission.
     * Can be `null` if no tech support is provided.
     * Will be added as HTML in frontend, thus allows for regular HTML styling
     *
     * @type {(string | null)}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true
        }
    })
    public techSupport: string | null;

    /**
     * Information about special rules set for the mission.
     * Can be `null` if no special rules are defined.
     * Will be added as HTML in frontend, thus allows for regular HTML styling
     *
     * @type {(string | null)}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true
        }
    })
    public rules: string | null;

    /**
     * Information about the gameserver the mission will be held on.
     * Can be `null` if no gameserver information is provided.
     *
     * @type {(IMissionServerInfo | null)}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
        validate: {
            validMissionServerInfo(val: any): void {
                const validationResult = Joi.validate(val, missionServerInfoSchema);
                if (!_.isNil(validationResult.error)) {
                    throw Boom.badRequest('Invalid mission server info', validationResult);
                }
            }
        }
    })
    public gameServer: IMissionServerInfo | null;

    /**
     * Information about the voice comms server used for the mission.
     * Can be `null` if no voice comm server information is provided.
     *
     * @type {(IMissionServerInfo | null)}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
        validate: {
            validMissionServerInfo(val: any): void {
                const validationResult = Joi.validate(val, missionServerInfoSchema);
                if (!_.isNil(validationResult.error)) {
                    throw Boom.badRequest('Invalid mission server info', validationResult);
                }
            }
        }
    })
    public voiceComms: IMissionServerInfo | null;

    /**
     * Information about the mod repositories used for the mission.
     * Can be an empty array if no mod repository information is provided.
     *
     * @type {IMissionRepositoryInfo[]}
     * @memberof Mission
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
     * Indicates the visibility status of the mission.
     * More detailed information about the visibility states can be found in the comments of the respective setting constants.
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.ENUM(MISSION_VISIBILITIES),
        allowNull: false,
        defaultValue: MISSION_VISIBILITY_HIDDEN
    })
    public visibility: string;

    /**
     * API token to grant regular user access to the mission, regardless of its visibility setting.
     * Can be used for static authentication without having to provide regular auth credentials, such as embedding in a website.
     *
     * @type {(string | null)}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null
    })
    public missionToken: string | null;

    /**
     * Indicates whether all slots for the mission should be created as auto-assignable.
     * Auto-assignable slots do not require a registration confirmation by a mission editor, but are automatically assigned to the first user that registers for them.
     *
     * @type {boolean}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    })
    public slotsAutoAssignable: boolean;

    /**
     * List of DLCs required to participate in the mission.
     * Currently not used in any restrictions, but merely added as an indication to players.
     *
     * @type {string[]}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
        validate: {
            validRequiredDLC(val: any): void {
                let localVal = val;
                if (!_.isArray(localVal)) {
                    localVal = [localVal];
                }

                _.each(localVal, (dlc: string) => {
                    if (_.indexOf(MISSION_REQUIRED_DLCS, dlc) === -1) {
                        throw Boom.badRequest('Invalid mission required DLC', dlc);
                    }
                });
            }
        }
    })
    public requiredDLCs: string[];

    /**
     * UID of the community the mission is associated with.
     * Can be `null` if the creating user has no community assigned
     *
     * @type {(string | null)}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
            model: Community,
            key: 'uid'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    })
    public communityUid: string | null;

    /**
     * Eager-loaded community instance.
     * Only included if the mission is associated with a community and it has been eager-loaded via sequelize
     *
     * @type {(Community | null | undefined)}
     * @memberof Mission
     */
    public community?: Community | null;

    /**
     * UID of the user that created the mission
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: User,
            key: 'uid'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })
    public creatorUid: string;

    /**
     * Eager-loaded creator user instance.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(User | undefined)}
     * @memberof Mission
     */
    public creator?: User;

    /**
     * Eager-loaded list accesses granted for the mission.
     * Only included if the extra access has been granted for the mission and it has been eager-loaded via sequelize
     *
     * @type {(MissionAccess[] | undefined)}
     * @memberof Mission
     */
    public missionAccesses?: MissionAccess[];

    /**
     * Eager-loaded list of slot groups associated with the mission.
     * Only included if the mission has slot groups associated and it has been eager-loaded via sequelize
     *
     * @type {(MissionSlotGroup[] | undefined)}
     * @memberof Mission
     */
    public slotGroups?: MissionSlotGroup[];

    /**
     * Time (and date) the mission instance was created
     *
     * @type {Date}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the mission instance was last updated
     *
     * @type {Date}
     * @memberof Mission
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
     * Creates a new slot group for the current mission
     *
     * @type {HasManyCreateAssociationMixin<MissionSlotGroup>}
     * @returns {Promise<MissionSlotGroup>} Mission slot group created
     * @memberof Mission
     */
    public createSlotGroup: HasManyCreateAssociationMixin<MissionSlotGroup>;

    /**
     * Retrieves the mission's community instance.
     * Only returns a result if the mission has been associated with a community
     *
     * @type {BelongsToGetAssociationMixin<Community>}
     * @returns {Promise<Community>} Community instance
     * @memberof Mission
     */
    public getCommunity: BelongsToGetAssociationMixin<Community>;

    /**
     * Retrieves the mission's creator user instance
     *
     * @type {BelongsToGetAssociationMixin<User>}
     * @returns {Promise<User>} User instance
     * @memberof Mission
     */
    public getCreator: BelongsToGetAssociationMixin<User>;

    /**
     * Retrieves the mission's access instances.
     * Returns an empty array if the no extra access has been granted for the mission
     *
     * @type {HasManyGetAssociationsMixin<MissionAccess>}
     * @returns {Promise<MissionAccess[]>} List of mission accesses
     * @memberof Mission
     */
    public getMissionAccesses: HasManyGetAssociationsMixin<MissionAccess>;

    /**
     * Retrieves the mission's slot group instances.
     * Returns an empty array if the mission has no slot groups assigned
     *
     * @type {HasManyGetAssociationsMixin<MissionSlotGroup>}
     * @returns {Promise<MissionSlotGroup[]>} List of mission slot groups
     * @memberof Mission
     */
    public getSlotGroups: HasManyGetAssociationsMixin<MissionSlotGroup>;

    /**
     * Removes the given slot group or a slot group with the provided UID from the missions's slot group list
     *
     * @type {HasManyRemoveAssociationMixin<MissionSlotGroup, string>}
     * @returns {Promise<void>} Promise fulfilled when removal is completed
     * @memberof Mission
     */
    public removeSlotGroup: HasManyRemoveAssociationMixin<MissionSlotGroup, string>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    /**
     * Checks whether the given slug is available for new missions
     *
     * @static
     * @param {string} newSlug Slug (can be unescaped) to check for
     * @returns {Promise<boolean>} Indicates whether the slug is available
     * @memberof Mission
     */
    // tslint:disable-next-line:function-name
    public static async isSlugAvailable(newSlug: string): Promise<boolean> {
        log.debug({ function: 'isSlugAvailable', newSlug }, 'Checking if mission slug is available');

        const mission = await this.findOne({
            where: { slug: slug(newSlug) },
            attributes: ['uid']
        });

        const isSlugAvailable = _.isNil(mission);

        log.debug({ function: 'isSlugAvailable', newSlug, isSlugAvailable }, 'Successfully finished checking if mission slug is available');

        return isSlugAvailable;
    }

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Creates a notification when a mission has been deleted, notifying all registered users and mission editors
     *
     * @returns {Promise<void>} Promise fulfilled when notifications have been created
     * @memberof Mission
     */
    public async createMissionDeletedNotifications(): Promise<void> {
        log.debug({ function: 'createMissionDeletedNotifications', missionUid: this.uid }, 'Creating deleted notifications for mission');

        const [registrations, editorPermissions] = await Promise.all([
            MissionSlotRegistration.findAll({
                include: [
                    {
                        model: MissionSlot,
                        as: 'slot',
                        attributes: ['uid'],
                        include: [
                            {
                                model: MissionSlotGroup,
                                as: 'slotGroup',
                                attributes: ['uid'],
                                include: [
                                    {
                                        model: Mission,
                                        as: 'mission',
                                        attributes: ['uid'],
                                        where: {
                                            uid: this.uid
                                        }
                                    }
                                ],
                                required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                            }
                        ],
                        required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                    }
                ]
            }),
            Permission.findAll({
                where: {
                    permission: {
                        $or: [`mission.${this.slug}.editor`, `mission.${this.slug}.slotlist.community`]
                    }
                }
            })
        ]);

        const userUids = _.uniq(_.concat(_.map(registrations, 'userUid'), _.map(editorPermissions, 'userUid')));

        const notifications = await Promise.map(userUids, (userUid: string) => {
            return Notification.create({
                userUid,
                notificationType: NOTIFICATION_TYPE_MISSION_DELETED,
                data: {
                    missionSlug: this.slug,
                    missionTitle: this.title
                }
            });
        });

        log.debug(
            { function: 'createMissionDeletedNotifications', missionUid: this.uid, notificationUids: _.map(notifications, 'uid') },
            'Successfully created deleted notifications for mission');
    }

    /**
     * Creates a notification when a mission has been updated, notifying all registered users
     *
     * @returns {Promise<void>} Promise fulfilled when notifications have been created
     * @memberof Mission
     */
    public async createMissionUpdatedNotifications(): Promise<void> {
        log.debug({ function: 'createMissionUpdatedNotifications', missionUid: this.uid }, 'Creating updated notifications for mission');

        const registrations = await MissionSlotRegistration.findAll({
            include: [
                {
                    model: MissionSlot,
                    as: 'slot',
                    attributes: ['uid'],
                    include: [
                        {
                            model: MissionSlotGroup,
                            as: 'slotGroup',
                            attributes: ['uid'],
                            include: [
                                {
                                    model: Mission,
                                    as: 'mission',
                                    attributes: ['uid'],
                                    where: {
                                        uid: this.uid
                                    }
                                }
                            ],
                            required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                        }
                    ],
                    required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                }
            ]
        });

        const userUids = _.uniq(_.map(registrations, 'userUid'));

        const notifications = await Promise.map(userUids, (userUid: string) => {
            return Notification.create({
                userUid,
                notificationType: NOTIFICATION_TYPE_MISSION_UPDATED,
                data: {
                    missionSlug: this.slug,
                    missionTitle: this.title
                }
            });
        });

        log.debug(
            { function: 'createMissionUpdatedNotifications', missionUid: this.uid, notificationUids: _.map(notifications, 'uid') },
            'Successfully created updated notifications for mission');
    }

    /**
     * Creates a notification for a mission permission that was either granted or revoked for a user
     *
     * @param {(User | string)} userOrUserUid User or user UID that had the permission granted or revoked
     * @param {string} permission Permission that was granted or revoked
     * @param {boolean} granted Indicates whether the permission was granted or revoked
     * @returns {Promise<void>} Promise fulfilled when notification has been created
     * @memberof Mission
     */
    public async createPermissionNotification(userOrUserUid: User | string, permission: string, granted: boolean): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findById(userOrUserUid);
            if (_.isNil(u)) {
                log.warn(
                    { function: 'createPermissionNotification', missionUid: this.uid, userUid: userOrUserUid },
                    'Cannot create permission notification for mission, user not found');
                throw Boom.notFound('User not found', { missionUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        log.debug({ function: 'createPermissionNotification', missionUid: this.uid, userUid: user.uid }, 'Creating permission notification for mission');

        const notification = await Notification.create({
            userUid: user.uid,
            notificationType: granted ? NOTIFICATION_TYPE_MISSION_PERMISSION_GRANTED : NOTIFICATION_TYPE_MISSION_PERMISSION_REVOKED,
            data: {
                permission,
                missionSlug: this.slug,
                missionTitle: this.title
            }
        });

        log.debug(
            { function: 'createPermissionNotification', missionUid: this.uid, userUid: user.uid, notificationUid: notification.uid },
            'Successfully created permission notification for mission');
    }

    /**
     * Creates a notification for a slot assignment change for the given user
     *
     * @param {(User | string)} userOrUserUid User or user UID that had the slot assigned or unassigned
     * @param {string} slotTitle Title of the slot that was assigned or unassigned
     * @param {boolean} assigned Indicates whether the slot was assigned or unassigned
     * @returns {Promise<void>} Promise fulfilled when notification was created
     * @memberof Mission
     */
    public async createSlotAssignmentChangedNotification(userOrUserUid: User | string, slotTitle: string, assigned: boolean): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findById(userOrUserUid);
            if (_.isNil(u)) {
                log.warn(
                    { function: 'createSlotAssignmentChangedNotification', missionUid: this.uid, userUid: userOrUserUid },
                    'Cannot create slot assignment notification for mission, user not found');
                throw Boom.notFound('User not found', { missionUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        let userCommunityTag: string | null = null;
        if (!_.isNil(user.communityUid)) {
            if (_.isNil(user.community)) {
                user.community = await user.getCommunity();
            }

            userCommunityTag = user.community.tag;
        }

        log.debug({ function: 'createSlotAssignmentChangedNotification', missionUid: this.uid, userUid: user.uid }, 'Creating slot assignment notification for mission');

        const notification = await Notification.create({
            userUid: user.uid,
            notificationType: assigned ? NOTIFICATION_TYPE_MISSION_SLOT_ASSIGNED : NOTIFICATION_TYPE_MISSION_SLOT_UNASSIGNED,
            data: {
                userUid: user.uid,
                userNickname: user.nickname,
                userCommunityTag,
                missionSlug: this.slug,
                missionTitle: this.title,
                slotTitle: slotTitle
            }
        });

        log.debug(
            { function: 'createSlotAssignmentChangedNotification', missionUid: this.uid, userUid: user.uid, notificationUid: notification.uid },
            'Successfully created slot assignment notification for mission');
    }

    /**
     * Creates a notification for a new slot registration that was removed by the provided user for all users with mission editor permissions
     *
     * @param {(User | string)} userOrUserUid User or user UID that unregistered from the slot
     * @param {string} slotTitle Title of the slot
     * @returns {Promise<void>} Promise fulfilled when notifications were created
     * @memberof Mission
     */
    public async createSlotRegistrationRemovedNotifications(userOrUserUid: User | string, slotTitle: string): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findById(userOrUserUid, { include: [{ model: Community, as: 'community' }] });
            if (_.isNil(u)) {
                log.warn(
                    { function: 'createSlotRegistrationRemovedNotifications', missionUid: this.uid, userUid: userOrUserUid },
                    'Cannot create slot registration removed notifications for mission, user not found');
                throw Boom.notFound('User not found', { missionUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        let queryOptions: any;
        let userCommunityTag: string | null = null;
        if (_.isNil(user.communityUid)) {
            queryOptions = {
                where: {
                    permission: {
                        $or: [`mission.${this.slug}.creator`, `mission.${this.slug}.editor`]
                    }
                }
            };
        } else {
            if (_.isNil(user.community)) {
                user.community = await user.getCommunity();
            }

            userCommunityTag = user.community.tag;

            queryOptions = {
                where: {
                    $or: [
                        {
                            permission: {
                                $or: [`mission.${this.slug}.creator`, `mission.${this.slug}.editor`]
                            }
                        },
                        {
                            permission: `mission.${this.slug}.slotlist.community`,
                            $or: [
                                // tslint:disable-next-line:max-line-length
                                literal(`"userUid" IN (SELECT "uid" FROM "users" WHERE "communityUid" = ${sequelize.escape(user.communityUid)})`)
                            ]
                        }
                    ]
                }
            };
        }

        const editorPermissions = await Permission.findAll(queryOptions);

        const userUids = _.uniq(_.map(editorPermissions, 'userUid'));

        const notifications = await Promise.map(userUids, (userUid: string) => {
            return Notification.create({
                userUid,
                notificationType: NOTIFICATION_TYPE_MISSION_SLOT_UNREGISTERED,
                data: {
                    userUid: user.uid,
                    userNickname: user.nickname,
                    userCommunityTag,
                    missionSlug: this.slug,
                    missionTitle: this.title,
                    slotTitle: slotTitle
                }
            });
        });

        log.debug(
            { function: 'createSlotRegistrationRemovedNotifications', missionUid: this.uid, userUid: user.uid, notificationUids: _.map(notifications, 'uid') },
            'Successfully created slot registration removed notifications for mission');
    }

    /**
     * Creates a notification for a new slot registration created by the provided user for all users with mission editor permissions
     *
     * @param {(User | string)} userOrUserUid User or user UID that registered for the slot
     * @param {string} slotTitle Title of the slot
     * @returns {Promise<void>} Promise fulfilled when notifications were created
     * @memberof Mission
     */
    public async createSlotRegistrationSubmittedNotifications(userOrUserUid: User | string, slotTitle: string): Promise<void> {
        let user: User;
        if (_.isString(userOrUserUid)) {
            const u = await User.findById(userOrUserUid, { include: [{ model: Community, as: 'community' }] });
            if (_.isNil(u)) {
                log.warn(
                    { function: 'createSlotRegistrationSubmittedNotifications', missionUid: this.uid, userUid: userOrUserUid },
                    'Cannot create slot registration submitted notifications for mission, user not found');
                throw Boom.notFound('User not found', { missionUid: this.uid, userUid: userOrUserUid });
            }

            user = u;
        } else {
            user = userOrUserUid;
        }

        let queryOptions: any;
        let userCommunityTag: string | null = null;
        if (_.isNil(user.communityUid)) {
            queryOptions = {
                where: {
                    permission: {
                        $or: [`mission.${this.slug}.creator`, `mission.${this.slug}.editor`]
                    }
                }
            };
        } else {
            if (_.isNil(user.community)) {
                user.community = await user.getCommunity();
            }

            userCommunityTag = user.community.tag;

            queryOptions = {
                where: {
                    $or: [
                        {
                            permission: {
                                $or: [`mission.${this.slug}.creator`, `mission.${this.slug}.editor`]
                            }
                        },
                        {
                            permission: `mission.${this.slug}.slotlist.community`,
                            $or: [
                                // tslint:disable-next-line:max-line-length
                                literal(`"userUid" IN (SELECT "uid" FROM "users" WHERE "communityUid" = ${sequelize.escape(user.communityUid)})`)
                            ]
                        }
                    ]
                }
            };
        }

        const editorPermissions = await Permission.findAll(queryOptions);

        const userUids = _.uniq(_.map(editorPermissions, 'userUid'));

        const notifications = await Promise.map(userUids, (userUid: string) => {
            return Notification.create({
                userUid,
                notificationType: NOTIFICATION_TYPE_MISSION_SLOT_REGISTRATION_NEW,
                data: {
                    userUid: user.uid,
                    userNickname: user.nickname,
                    userCommunityTag,
                    missionSlug: this.slug,
                    missionTitle: this.title,
                    slotTitle: slotTitle
                }
            });
        });

        log.debug(
            { function: 'createSlotRegistrationSubmittedNotifications', missionUid: this.uid, userUid: user.uid, notificationUids: _.map(notifications, 'uid') },
            'Successfully created slot registration submitted notifications for mission');
    }

    /**
     * Creates a new slot in the mission, automatically associating it with the provided slot group.
     *
     * @param {IMissionSlotCreatePayload} slotPayload Payload including slot details and slot group UID
     * @returns {Promise<MissionSlot>} Newly created mission slot
     * @memberof Mission
     */
    public async createSlot(slotPayload: IMissionSlotCreatePayload): Promise<MissionSlot> {
        const slotGroups = await this.getSlotGroups({ where: { uid: slotPayload.slotGroupUid } });
        if (_.isNil(slotGroups) || _.isEmpty(slotGroups)) {
            throw Boom.notFound('Mission slot group not found');
        }
        const slotGroup = slotGroups[0];

        const currentSlots = _.sortBy(await slotGroup.getSlots(), 'orderNumber');
        slotPayload.orderNumber = slotPayload.insertAfter + 1;

        if (slotPayload.insertAfter !== currentSlots.length) {
            await Promise.map(currentSlots, (slot: MissionSlot) => {
                if (slot.orderNumber < slotPayload.orderNumber) {
                    return slot;
                }

                return slot.increment('orderNumber');
            });
        }

        return slotGroup.createSlot(slotPayload);
    }

    /**
     * Finds a slot by its UID, skipping the requirement to load and iterate all slot groups
     *
     * @param {string} slotUid UID of the slot to search for
     * @returns {(Promise<MissionSlot | null>)} Mission slot instance. Returns null if no slot was found
     * @memberof Mission
     */
    public async findSlot(slotUid: string): Promise<MissionSlot | null> {
        return MissionSlot.findById(slotUid);
    }

    /**
     * Generates a new mission access token, updates the current instance in the database and returns the updated mission.
     * Overwrites any mission token previously set, thus invalidating it.
     *
     * @returns {Promise<Mission>} Updated mission with newly generated mission token set
     * @memberof Mission
     */
    public async generateMissionToken(): Promise<Mission> {
        return this.update({
            missionToken: uuid.v4()
        });
    }

    // tslint:disable:max-line-length
    /**
     * Returns slot count information about the current mission.
     * Slot counts include counts of `unassigned`, `blocked`, `assigned`, etc. slots.
     *
     * @param {(string | null)} [requestingUserUid=null] UID of user requesting mission information, only available for some calls if user is authenticated
     * @param {(string | null)} [requestingUserCommunityUid=null] UID of communtiy of user requesting mission information, only available for some calls if user is authenticated and in a community
     * @returns {Promise<IMissionSlotCounts>} Number of slots with different status
     * @memberof Mission
     */
    // tslint:enable:max-line-length
    public async getSlotCounts(requestingUserUid: string | null = null, requestingUserCommunityUid: string | null = null): Promise<IMissionSlotCounts> {
        const slots = await MissionSlot.findAll({
            attributes: ['assigneeUid', 'blocked', 'externalAssignee', 'reserve', 'restrictedCommunityUid', 'uid'],
            include: [
                {
                    model: MissionSlotGroup,
                    as: 'slotGroup',
                    attributes: ['uid'],
                    include: [
                        {
                            model: Mission,
                            as: 'mission',
                            attributes: ['uid'],
                            where: {
                                uid: this.uid
                            }
                        }
                    ],
                    required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                },
                {
                    model: MissionSlotRegistration,
                    as: 'registrations',
                    attributes: ['uid', 'userUid']
                }
            ]
        });

        const counts: IMissionSlotCounts = {
            assigned: 0,
            blocked: 0,
            external: 0,
            open: 0,
            reserve: 0,
            restricted: 0,
            total: slots.length,
            unassigned: 0
        };

        const registeredUserUidsCounted: string[] = <string[]>_.map(_.filter(slots, (slot: MissionSlot) => !_.isNil(slot.assigneeUid)), 'assigneeUid');

        _.each(slots, (slot: MissionSlot) => {
            if (!_.isNil(slot.assigneeUid)) {
                counts.assigned += 1;
            } else if (!_.isNil(slot.externalAssignee)) {
                counts.external += 1;
            } else if (slot.blocked) {
                counts.blocked += 1;
            } else if (!_.isNil(slot.restrictedCommunityUid) && slot.restrictedCommunityUid === requestingUserCommunityUid && _.isEmpty(slot.registrations)) {
                counts.open += 1;
            } else if (!_.isNil(slot.restrictedCommunityUid) && slot.restrictedCommunityUid !== requestingUserCommunityUid && _.isEmpty(slot.registrations)) {
                counts.restricted += 1;
            } else if (!_.isEmpty(slot.registrations)) {
                let hasUniqueUserRegistration: boolean = false;
                _.each(slot.registrations, (registration: MissionSlotRegistration) => {
                    if (_.indexOf(registeredUserUidsCounted, registration.userUid) === -1) {
                        hasUniqueUserRegistration = true;
                        registeredUserUidsCounted.push(registration.userUid);
                    }
                });

                if (hasUniqueUserRegistration) {
                    counts.unassigned += 1;
                } else {
                    if (slot.reserve) {
                        counts.reserve += 1;
                    } else {
                        counts.open += 1;
                    }
                }
            } else if (slot.reserve) {
                counts.reserve += 1;
            } else {
                counts.open += 1;
            }
        });

        return counts;
    }

    /**
     * Returns a list of all slots of a mission, optionally filtering for the provided slot group
     *
     * @param {(string | null)} [slotGroupUid=null] Optional slot group UID to filter for, omitting the value or providing `null` retrieves all slots
     * @returns {Promise<MissionSlot[]>} List of mission slots retrieved
     * @memberof Mission
     */
    public async getSlots(slotGroupUid: string | null = null): Promise<MissionSlot[]> {
        const slotGroupQueryOptions: any = {};
        if (!_.isNil(slotGroupUid) && !_.isEmpty(slotGroupUid)) {
            slotGroupQueryOptions.where = { uid: slotGroupUid };
        }
        const slotGroups = await this.getSlotGroups(slotGroupQueryOptions);

        return Promise.reduce(
            slotGroups, async (slots: MissionSlot[], slotGroup: MissionSlotGroup) => {
                return slots.concat(await slotGroup.getSlots());
            },
            []);
    }

    /**
     * Checks whether a user is already assigned to any slot of this mission
     *
     * @param {string} userUid UID of user to check assignments for
     * @returns {Promise<boolean>} Promise fulfilled with result of assignment check
     * @memberof Mission
     */
    public async isUserAssignedToAnySlot(userUid: string): Promise<boolean> {
        const assignedSlotCount = await MissionSlot.count({
            where: {
                assigneeUid: userUid
            },
            include: [
                {
                    model: MissionSlotGroup,
                    as: 'slotGroup',
                    attributes: ['uid'],
                    include: [
                        {
                            model: Mission,
                            as: 'mission',
                            attributes: ['uid'],
                            where: {
                                uid: this.uid
                            }
                        }
                    ],
                    required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                }
            ]
        });

        return assignedSlotCount > 0;
    }

    /**
     * Checks whether a user has registered for any slot of this mission
     *
     * @param {string} userUid UID of user to check registrations for
     * @returns {Promise<boolean>} Promise fulfilled with result of registration check
     * @memberof Mission
     */
    public async isUserRegisteredForAnySlot(userUid: string): Promise<boolean> {
        const registeredSlotCount = await MissionSlotRegistration.count({
            where: {
                userUid
            },
            include: [
                {
                    model: MissionSlot,
                    as: 'slot',
                    attributes: ['uid'],
                    include: [
                        {
                            model: MissionSlotGroup,
                            as: 'slotGroup',
                            attributes: ['uid'],
                            include: [
                                {
                                    model: Mission,
                                    as: 'mission',
                                    attributes: ['uid'],
                                    where: {
                                        uid: this.uid
                                    }
                                }
                            ],
                            required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                        }
                    ],
                    required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                }
            ]
        });

        return registeredSlotCount > 0;
    }

    /**
     * Recalculates and adapts the order numbers of all slots in the mission.
     * Slots are ordered one after another according to the slot group and the old position within the group
     *
     * @returns {Promise<void>} Promise fulfilled when recalculation is finished
     * @memberof Mission
     */
    public async recalculateSlotOrderNumbers(): Promise<void> {
        let slotGroups = await MissionSlotGroup.findAll({
            where: {
                missionUid: this.uid
            },
            include: [
                {
                    model: MissionSlot,
                    as: 'slots'
                }
            ]
        });
        slotGroups = _.sortBy(slotGroups, 'orderNumber');

        let slotOrderNumber = 0; // Start at 0 because value gets increased at start of every iteration
        const slotsToUpdate: MissionSlot[] = [];
        _.each(slotGroups, async (slotGroup: MissionSlotGroup) => {
            const slots = _.sortBy(slotGroup.slots, 'orderNumber');

            _.each(slots, (slot: MissionSlot) => {
                slotOrderNumber += 1;

                if (slot.orderNumber !== slotOrderNumber) {
                    slotsToUpdate.push(slot.set({ orderNumber: slotOrderNumber }));
                }
            });
        });

        await Promise.map(slotsToUpdate, (slot: MissionSlot) => {
            return slot.save();
        });
    }

    // tslint:disable:max-line-length
    /**
     * Returns a public representation of the mission instance, as transmitted via API
     *
     * @param {(string | null)} [requestingUserUid=null] UID of user requesting mission information, only available for some calls if user is authenticated
     * @param {(string | null)} [requestingUserCommunityUid=null] UID of communtiy of user requesting mission information, only available for some calls if user is authenticated and in a community
     * @returns {Promise<IPublicMission>} Object containing public mission information
     * @memberof Mission
     */
    // tslint:enable:max-line-length
    public async toPublicObject(requestingUserUid: string | null = null, requestingUserCommunityUid: string | null = null): Promise<IPublicMission> {
        if (_.isNil(this.creator)) {
            this.creator = await this.getCreator();
        }

        const [publicCreator, slotCounts] = await Promise.all([
            this.creator.toPublicObject(),
            this.getSlotCounts(requestingUserUid, requestingUserCommunityUid)
        ]);

        return {
            title: this.title,
            slug: this.slug,
            startTime: this.startTime,
            endTime: this.endTime,
            creator: publicCreator,
            requiredDLCs: this.requiredDLCs,
            slotCounts
        };
    }

    // tslint:disable:max-line-length
    /**
     * Returns a detailed public representation of the mission instance, as transmitted via API
     *
     * @param {(string | null)} [requestingUserUid=null] UID of user requesting mission information, only available for some calls if user is authenticated
     * @param {(string | null)} [requestingUserCommunityUid=null] UID of communtiy of user requesting mission information, only available for some calls if user is authenticated and in a community
     * @returns {Promise<IDetailedPublicMission>} Object containing detailed public mission information
     * @memberof Mission
     */
    // tslint:enable:max-line-length
    public async toDetailedPublicObject(requestingUserUid: string | null = null, requestingUserCommunityUid: string | null = null): Promise<IDetailedPublicMission> {
        if (!_.isNil(this.communityUid)) {
            if (_.isNil(this.community)) {
                this.community = await this.getCommunity();
            }
        }

        if (_.isNil(this.creator)) {
            this.creator = await this.getCreator();
        }

        const [publicCommunity, publicCreator, slotCounts] = await Promise.all([
            !_.isNil(this.communityUid) && !_.isNil(this.community) ? this.community.toPublicObject() : Promise.resolve(null),
            this.creator.toPublicObject(),
            this.getSlotCounts(requestingUserUid, requestingUserCommunityUid)
        ]);

        return {
            title: this.title,
            slug: this.slug,
            description: this.description,
            detailedDescription: this.detailedDescription,
            collapsedDescription: _.isNil(this.collapsedDescription) ? null : this.collapsedDescription,
            bannerImageUrl: _.isNil(this.bannerImageUrl) ? null : this.bannerImageUrl,
            briefingTime: this.briefingTime,
            slottingTime: this.slottingTime,
            startTime: this.startTime,
            endTime: this.endTime,
            techSupport: _.isNil(this.techSupport) ? null : this.techSupport,
            rules: _.isNil(this.rules) ? null : this.rules,
            gameServer: _.isNil(this.gameServer) ? null : this.gameServer,
            voiceComms: _.isNil(this.voiceComms) ? null : this.voiceComms,
            repositories: this.repositories,
            slotsAutoAssignable: this.slotsAutoAssignable,
            requiredDLCs: this.requiredDLCs,
            visibility: this.visibility,
            community: publicCommunity,
            creator: publicCreator,
            slotCounts
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public mission information as transmitted via API
 *
 * @export
 * @interface IPublicMission
 */
export interface IPublicMission {
    title: string;
    slug: string;
    startTime: Date;
    endTime: Date;
    creator: IPublicUser;
    slotCounts: IMissionSlotCounts;
    requiredDLCs: string[];
    isAssignedToAnySlot?: boolean; // only returned for logged in users
    isRegisteredForAnySlot?: boolean; // only returned for logged in users
}

/**
 * Detailed public mission information as transmitted via API
 *
 * @export
 * @interface IDetailedPublicMission
 * @extends {IPublicMission}
 */
export interface IDetailedPublicMission extends IPublicMission {
    description: string;
    detailedDescription: string;
    collapsedDescription: string | null;
    bannerImageUrl: string | null;
    briefingTime: Date;
    slottingTime: Date;
    techSupport: string | null;
    rules: string | null;
    gameServer: IMissionServerInfo | null;
    voiceComms: IMissionServerInfo | null;
    repositories: IMissionRepositoryInfo[];
    visibility: string;
    slotsAutoAssignable: boolean;
    community: IPublicCommunity | null;
}

/**
 * Summarises the current slotlist as counts of slot assignment statuses
 *
 * @export
 * @interface IMissionSlotCounts
 */
export interface IMissionSlotCounts {
    assigned: number;
    blocked: number;
    external: number;
    open: number;
    reserve: number;
    restricted: number;
    total: number;
    unassigned: number;
}

/**
 * Information about a server used for a mission.
 * Can either be used to represent gameservers or voice comms.
 *
 * @export
 * @interface IMissionServerInfo
 */
export interface IMissionServerInfo {
    name: string | null;
    hostname: string;
    port: number;
    password: string | null;
}

/**
 * Information about a mod repository used for a mission.
 * Can either be an Arma3Sync repository (extra integration in the frontend) or a custom one.
 *
 * @export
 * @interface IMissionRepositoryInfo
 */
export interface IMissionRepositoryInfo {
    name: string | null;
    kind: string;
    url: string | null;
    notes: string | null;
}
