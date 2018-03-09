import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';

import { Community } from './Community';
import { IPublicUser, User } from './User';

export const COMMUNITY_APPLICATION_STATUS_ACCEPTED = 'accepted';
export const COMMUNITY_APPLICATION_STATUS_DENIED = 'denied';
export const COMMUNITY_APPLICATION_STATUS_SUBMITTED = 'submitted';
export const COMMUNITY_APPLICATION_STATUSES = [
    COMMUNITY_APPLICATION_STATUS_ACCEPTED,
    COMMUNITY_APPLICATION_STATUS_DENIED,
    COMMUNITY_APPLICATION_STATUS_SUBMITTED
];

/**
 * Represents a community application in database.
 * Provides database access and utility functionality for community application instances
 *
 * @export
 * @class CommunityApplication
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'communityApplications',
    paranoid: false,
    indexes: [
        {
            name: 'communityApplications_unique_communityUid_userUid',
            fields: ['communityUid', 'userUid'],
            unique: true
        }
    ]
})
export class CommunityApplication extends Model {
    /**
     * Associations of the permission model
     *
     * @static
     * @type {{
     *         community: BelongsTo,
     *         user: BelongsTo
     *     }}
     * @memberof Permission
     */
    public static associations: {
        community: BelongsTo;
        user: BelongsTo;
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the community application in the database
     *
     * @type {string}
     * @memberof CommunityApplication
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Represents the status of the community application.
     * Applications are created with status `submitted` and can either be `accepted` or `denied`
     *
     * @type {string}
     * @memberof CommunityApplication
     */
    @Attribute({
        type: DataTypes.ENUM(COMMUNITY_APPLICATION_STATUSES),
        allowNull: false,
        defaultValue: COMMUNITY_APPLICATION_STATUS_SUBMITTED
    })
    public status: string;

    /**
     * UID of the communty the user applied to
     *
     * @type {string}
     * @memberof CommunityApplication
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Community,
            key: 'uid'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })
    public communityUid: string;

    /**
     * Eager-loaded instance of the community the user applied to.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(Community | undefined)}
     * @memberof CommunityApplication
     */
    public community?: Community;

    /**
     * UID of the user applying to the community
     *
     * @type {string}
     * @memberof CommunityApplication
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
     * Eager-loaded instance of the user applying to the community.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(User | undefined)}
     * @memberof CommunityApplication
     */
    public user?: User;

    /**
     * Time (and date) the community application instance was created
     *
     * @type {Date}
     * @memberof CommunityApplication
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the community application instance was last updated
     *
     * @type {Date}
     * @memberof CommunityApplication
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
     * Retrieves the application's community instance
     *
     * @type {BelongsToGetAssociationMixin<Community>}
     * @returns {Promise<Community>} User instance
     * @memberof CommunityApplication
     */
    public getCommunity: BelongsToGetAssociationMixin<Community>;

    /**
     * Retrieves the community application's user instance
     *
     * @type {BelongsToGetAssociationMixin<User>}
     * @returns {Promise<User>} User instance
     * @memberof CommunityApplication
     */
    public getUser: BelongsToGetAssociationMixin<User>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the community application instance, as transmitted via API
     *
     * @returns {Promise<IPublicCommunityApplication>} Object containing public community application information
     * @memberof CommunityApplication
     */
    public async toPublicObject(): Promise<IPublicCommunityApplication> {
        if (_.isNil(this.user)) {
            this.user = await this.getUser();
        }
        const publicUser = await this.user.toPublicObject();

        return {
            uid: this.uid,
            user: publicUser,
            status: this.status
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public community application information as transmitted via API
 *
 * @export
 * @interface IPublicCommunityApplication
 */
export interface IPublicCommunityApplication {
    uid: string;
    user: IPublicUser;
    status: string;
}
