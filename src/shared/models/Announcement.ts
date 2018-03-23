import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import { log as logger } from '../util/log';
import sequelize from '../util/sequelize';
const log = logger.child({ model: 'Announcement' });

import { NOTIFICATION_TYPE_ANNOUNCEMENT_GENERIC, NOTIFICATION_TYPE_ANNOUNCEMENT_UPDATE } from '../types/notification';
import { Notification } from './Notification';
import { IPublicUser, User } from './User';

/**
 * Represents a generic announcement
 */
export const ANNOUNCEMENT_TYPE_GENERIC = 'generic';
/**
 * Represents an announcement regarding updates
 */
export const ANNOUNCEMENT_TYPE_UPDATE = 'update';

/**
 * List of possible `announcementType` values, indicating the type of the announcement
 */
export const ANNOUNCEMENT_TYPES = [
    ANNOUNCEMENT_TYPE_GENERIC,
    ANNOUNCEMENT_TYPE_UPDATE
];

/**
 * Represents a announcement in database.
 * Provides database access and utility functionality for announcement instances
 *
 * @export
 * @class Announcement
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'announcements',
    paranoid: false
})
export class Announcement extends Model {
    /**
     * Associations of the announcement model
     *
     * @static
     * @type {{
     *         user: BelongsTo
     *     }}
     * @memberof Announcement
     */
    public static associations: {
        user: BelongsTo;
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the announcement in the database
     *
     * @type {string}
     * @memberof Announcement
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Title of the announcement
     *
     * @type {string}
     * @memberof Announcement
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
     * Content of the announcement, can contain HTML for formatting
     *
     * @type {string}
     * @memberof Announcement
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public content: string;

    /**
     * Type of announcement
     *
     * @type {string}
     * @memberof Announcement
     */
    @Attribute({
        type: DataTypes.ENUM(ANNOUNCEMENT_TYPES),
        allowNull: false,
        defaultValue: ANNOUNCEMENT_TYPE_GENERIC
    })
    public announcementType: string;

    /**
     * Time (and date) the announcement should be visible from.
     * Can be `null` if the announcement should be immediately visible.
     *
     * @type {(Date | null | undefined)}
     * @memberof Announcement
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    })
    public visibleFrom?: Date | null;

    /**
     * UID of the user that created the announcement
     *
     * @type {string}
     * @memberof Announcement
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
     * Eager-loaded user instance that created the announcement.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(User | undefined)}
     * @memberof Announcement
     */
    public user?: User;

    /**
     * Time (and date) the announcement instance was created
     *
     * @type {Date}
     * @memberof Announcement
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the announcement instance was last updated
     *
     * @type {Date}
     * @memberof Announcement
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
     * Retrieves the announcement creator's user instance
     *
     * @type {BelongsToGetAssociationMixin<User>}
     * @returns {Promise<User>} User instance
     * @memberof Announcement
     */
    public getUser: BelongsToGetAssociationMixin<User>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    /**
     * Create a new Announcement entry and sends a notification to all users
     *
     * @static
     * @param {string} title Title of the new announcement entry
     * @param {string} content Content of the new announcement entry
     * @param {string} announcementType Type of the announcement, changing display/notification sent
     * @param {(Date | null)} visibleFrom Date and type from which the announcement should be visible from. Set to `null` if the announcement should be immediately visible
     * @param {string} userUid UID of user that created the announcement entry
     * @returns {Promise<Announcement>} Promise fulfilled with newly created announcement instance
     * @memberof Announcement
     */
    // tslint:disable-next-line:function-name
    public static async createAndNotify(title: string, content: string, announcementType: string, visibleFrom: Date | null, userUid: string): Promise<Announcement> {
        log.debug({ function: 'createAndNotify', title, announcementType, visibleFrom, userUid }, 'Creating announcement entry');

        const announcement = await new Announcement({
            title: title,
            content: content,
            announcementType: announcementType,
            visibleFrom: visibleFrom,
            userUid: userUid
        }).save();

        const notificationUsers = _.filter(await User.findAll(), (u: User) => u.uid !== userUid);

        let notificationType: string;
        switch (announcementType) {
            case ANNOUNCEMENT_TYPE_UPDATE:
                notificationType = NOTIFICATION_TYPE_ANNOUNCEMENT_UPDATE;
                break;
            case ANNOUNCEMENT_TYPE_GENERIC:
            default:
                notificationType = NOTIFICATION_TYPE_ANNOUNCEMENT_GENERIC;
        }

        log.debug(
            {
                function: 'createAndNotify',
                title,
                announcementType,
                visibleFrom,
                userUid,
                announcementUid: announcement.uid,
                notificationType,
                notificationUserCount: notificationUsers.length
            },
            'Creating announcement notifications');

        await Promise.map(notificationUsers, async (notificationUser: User) => {
            try {
                await Notification.create({
                    userUid: notificationUser.uid,
                    notificationType: notificationType,
                    data: {
                        announcementUid: announcement.uid,
                        title: announcement.title
                    }
                });
            } catch (err) {
                log.warn(
                    {
                        function: 'createAndNotify',
                        title,
                        announcementType,
                        visibleFrom,
                        userUid,
                        announcementUid: announcement.uid,
                        notificationType,
                        notificationUserCount: notificationUsers.length,
                        notificationUserUid: notificationUser.uid,
                        err
                    },
                    'Failed to create announcement notification for user, ignoring');
            }
        });

        log.debug(
            {
                function: 'createAndNotify',
                title,
                announcementType,
                visibleFrom,
                userUid,
                announcementUid: announcement.uid,
                notificationType,
                notificationUserCount: notificationUsers.length
            },
            'Finished creating announcement notifications');

        return announcement;
    }

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the announcement instance, as transmitted via API
     *
     * @returns {Promise<IPublicAnnouncement>} Object containing public announcement information
     * @memberof Announcement
     */
    public async toPublicObject(): Promise<IPublicAnnouncement> {
        if (_.isNil(this.user)) {
            this.user = await this.getUser();
        }

        const publicUser = await this.user.toPublicObject();

        return {
            uid: this.uid,
            title: this.title,
            content: this.content,
            user: publicUser,
            createdAt: this.createdAt,
            visibleFrom: _.isNil(this.visibleFrom) ? null : this.visibleFrom
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public announcement information as transmitted via API
 *
 * @export
 * @interface IPublicAnnouncement
 */
export interface IPublicAnnouncement {
    uid: string;
    title: string;
    content: string;
    user: IPublicUser;
    createdAt: Date;
    visibleFrom: Date | null;
}
