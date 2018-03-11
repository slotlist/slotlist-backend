import * as Boom from 'boom';
import * as Joi from 'joi';
import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';

import {
    notificationDataCommunityApplicationSchema,
    notificationDataCommunitySchema,
    notificationDataGenericSchema,
    notificationDataMissionSchema,
    notificationDataMissionSlotSchema,
    notificationDataPermissionSchema
} from '../schemas/notification';
import {
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_ACCEPTED,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DELETED,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DENIED,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_NEW,
    NOTIFICATION_TYPE_COMMUNITY_APPLICATION_REMOVED,
    NOTIFICATION_TYPE_COMMUNITY_DELETED,
    NOTIFICATION_TYPE_COMMUNITY_PERMISSION_GRANTED,
    NOTIFICATION_TYPE_COMMUNITY_PERMISSION_REVOKED,
    NOTIFICATION_TYPE_GENERIC,
    NOTIFICATION_TYPE_MISSION_DELETED,
    NOTIFICATION_TYPE_MISSION_PERMISSION_GRANTED,
    NOTIFICATION_TYPE_MISSION_PERMISSION_REVOKED,
    NOTIFICATION_TYPE_MISSION_SLOT_ASSIGNED,
    NOTIFICATION_TYPE_MISSION_SLOT_REGISTRATION_NEW,
    NOTIFICATION_TYPE_MISSION_SLOT_UNASSIGNED,
    NOTIFICATION_TYPE_MISSION_SLOT_UNREGISTERED,
    NOTIFICATION_TYPE_MISSION_UPDATED,
    NOTIFICATION_TYPES
} from '../types/notification';
import { User } from './User';

/**
 * Represents a notification in database.
 * Provides database access and utility functionality for notification instances
 *
 * @export
 * @class Notification
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'notifications',
    paranoid: false
})
export class Notification extends Model {
    /**
     * Associations of the notification model
     *
     * @static
     * @type {{
     *         user: BelongsTo
     *     }}
     * @memberof Notification
     */
    public static associations: {
        user: BelongsTo;
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the notification in the database
     *
     * @type {string}
     * @memberof Notification
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Type of notification
     *
     * @type {string}
     * @memberof Notification
     */
    @Attribute({
        type: DataTypes.ENUM(NOTIFICATION_TYPES),
        allowNull: false,
        defaultValue: NOTIFICATION_TYPE_GENERIC
    })
    public notificationType: string;

    /**
     * Stores additional data, providing information about what triggered the notification.
     * Can e.g. contain a missionSlug, communitySlug, userUid, permission or likewise.
     *
     * @type {(INotificationDataCommunity |
     *     INotificationDataCommunityApplication |
     *     INotificationDataGeneric |
     *     INotificationDataMission |
     *     INotificationDataMissionSlot |
     *     INotificationDataPermission)}
     * @memberof Notification
     */
    @Attribute({
        type: DataTypes.JSONB,
        allowNull: false,
        validate: {
            validNotificationData(val: any): void {
                let schema: Joi.Schema;
                switch (this.notificationType) {
                    case NOTIFICATION_TYPE_COMMUNITY_APPLICATION_ACCEPTED:
                    case NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DELETED:
                    case NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DENIED:
                    case NOTIFICATION_TYPE_COMMUNITY_APPLICATION_NEW:
                    case NOTIFICATION_TYPE_COMMUNITY_APPLICATION_REMOVED:
                        schema = notificationDataCommunityApplicationSchema;
                        break;
                    case NOTIFICATION_TYPE_COMMUNITY_DELETED:
                        schema = notificationDataCommunitySchema;
                        break;
                    case NOTIFICATION_TYPE_COMMUNITY_PERMISSION_GRANTED:
                    case NOTIFICATION_TYPE_COMMUNITY_PERMISSION_REVOKED:
                    case NOTIFICATION_TYPE_MISSION_PERMISSION_GRANTED:
                    case NOTIFICATION_TYPE_MISSION_PERMISSION_REVOKED:
                        schema = notificationDataPermissionSchema;
                        break;
                    case NOTIFICATION_TYPE_MISSION_DELETED:
                    case NOTIFICATION_TYPE_MISSION_UPDATED:
                        schema = notificationDataMissionSchema;
                        break;
                    case NOTIFICATION_TYPE_MISSION_SLOT_ASSIGNED:
                    case NOTIFICATION_TYPE_MISSION_SLOT_REGISTRATION_NEW:
                    case NOTIFICATION_TYPE_MISSION_SLOT_UNASSIGNED:
                    case NOTIFICATION_TYPE_MISSION_SLOT_UNREGISTERED:
                        schema = notificationDataMissionSlotSchema;
                        break;
                    case NOTIFICATION_TYPE_GENERIC:
                    default:
                        schema = notificationDataGenericSchema;
                }

                const validationResult = Joi.validate(val, schema);
                if (!_.isNil(validationResult.error)) {
                    throw Boom.badRequest('Invalid notification data', validationResult);
                }
            }
        }
    })
    public data: INotificationDataCommunity |
    INotificationDataCommunityApplication |
    INotificationDataGeneric |
    INotificationDataMission |
    INotificationDataMissionSlot |
    INotificationDataPermission;

    /**
     * UID of the user the notification has been created for
     *
     * @type {(string)}
     * @memberof Notification
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
    public userUid: string;

    /**
     * Eager-loaded user instance.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(User | undefined)}
     * @memberof Notification
     */
    public user?: User;

    /**
     * Time (and date) the notification has been marked as seen at.
     * Seen notifications do not show up in the notification indicator or the notification list unless explicity loaded.
     *
     * @type {boolean}
     * @memberof Notification
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    })
    public seenAt: Date | null;

    /**
     * Time (and date) the notification instance was created
     *
     * @type {Date}
     * @memberof Notification
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the notification instance was last updated
     *
     * @type {Date}
     * @memberof Notification
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
     * Retrieves the notification's user instance
     *
     * @type {BelongsToGetAssociationMixin<User>}
     * @returns {Promise<User>} User instance
     * @memberof Notification
     */
    public getUser: BelongsToGetAssociationMixin<User>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the notification instance, as transmitted via API
     *
     * @returns {Promise<IPublicNotification>} Object containing public notification information
     * @memberof Notification
     */
    public async toPublicObject(): Promise<IPublicNotification> {
        return {
            uid: this.uid,
            notificationType: this.notificationType,
            data: this.data,
            seenAt: this.seenAt,
            createdAt: this.createdAt
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public notification information as transmitted via API
 *
 * @export
 * @interface IPublicNotification
 */
export interface IPublicNotification {
    uid: string;
    notificationType: string;
    data: INotificationDataCommunity |
    INotificationDataCommunityApplication |
    INotificationDataGeneric |
    INotificationDataMission |
    INotificationDataMissionSlot |
    INotificationDataPermission;
    seenAt: Date | null;
    createdAt: Date;
}

/**
 * Additional notification data for type `NOTIFICATION_TYPE_COMMUNITY_DELETED`.
 * Contains information about the community that was deleted.
 *
 * @export
 * @interface INotificationDataCommunity
 */
export interface INotificationDataCommunity {
    communitySlug: string;
    communityName: string;
}

/**
 * Additional notification data for types `NOTIFICATION_TYPE_COMMUNITY_APPLICATION_ACCEPTED`, `NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DELETED`,
 * `NOTIFICATION_TYPE_COMMUNITY_APPLICATION_DENIED` and `NOTIFICATION_TYPE_COMMUNITY_APPLICATION_NEW`, `NOTIFICATION_TYPE_COMMUNITY_APPLICATION_REMOVED`.
 * Contains information about the user that created the application as well as the community it was created for.
 *
 * @export
 * @interface INotificationDataCommunityApplication
 */
export interface INotificationDataCommunityApplication {
    communitySlug: string;
    communityName: string;
    userUid: string;
    userNickname: string;
}

/**
 * Additional notification data for type `NOTIFICATION_TYPE_GENERIC`.
 * Contains a generic message to display to the user.
 *
 * @export
 * @interface INotificationDataGeneric
 */
export interface INotificationDataGeneric {
    message: string;
}

/**
 * Additional notification data for types `NOTIFICATION_TYPE_MISSION_DELETED` and `NOTIFICATION_TYPE_MISSION_UPDATED`.
 * Contains information about the mission that was modified.
 *
 * @export
 * @interface INotificationDataMission
 */
export interface INotificationDataMission {
    missionSlug: string;
    missionTitle: string;
}

/**
 * Additional notification data for types `NOTIFICATION_TYPE_MISSION_SLOT_ASSIGNED`, `NOTIFICATION_TYPE_MISSION_SLOT_REGISTRATION_NEW`,
 * `NOTIFICATION_TYPE_MISSION_SLOT_UNASSIGNED` and `NOTIFICATION_TYPE_MISSION_SLOT_UNREGISTERED`.
 * Contains information about the mission as well as the slot and the user the assignment was created for.
 *
 * @export
 * @interface INotificationDataMissionSlot
 */
export interface INotificationDataMissionSlot {
    missionSlug: string;
    missionTitle: string;
    slotTitle: string;
    userUid: string;
    userNickname: string;
    userCommunityTag: string | null;
}

/**
 * Additional notification data for types `NOTIFICATION_TYPE_COMMUNITY_PERMISSION_GRANTED`, `NOTIFICATION_TYPE_COMMUNITY_PERMISSION_REVOKED`,
 * `NOTIFICATION_TYPE_MISSION_PERMISSION_GRANTED` and `NOTIFICATION_TYPE_MISSION_PERMISSION_GRANTED`.
 * Contains the permission that was changed as well as info about either the community or mission affected.
 *
 * @export
 * @interface INotificationDataPermission
 */
export interface INotificationDataPermission {
    permission: string;
    communitySlug?: string;
    communityName?: string;
    missionSlug?: string;
    missionTitle?: string;
}
