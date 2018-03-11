import * as Boom from 'boom';
import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';

import { Community, IPublicCommunity } from './Community';
import { Mission } from './Mission';
import { IPublicUser, User } from './User';

/**
 * Represents a mission access in database.
 * Provides database access and utility functionality for mission access instances
 *
 * @export
 * @class MissionAccess
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'missionAccesses',
    paranoid: false,
    indexes: [
        {
            name: 'missionAccesses_unique_missionUid_communityUid',
            fields: ['missionUid', 'communityUid'],
            unique: true
        },
        {
            name: 'missionAccesses_unique_missionUid_userUid',
            fields: ['missionUid', 'userUid'],
            unique: true
        }
    ],
    validate: {
        communityOrUserAccess(): void {
            if (_.isNil(this.communityUid) && _.isNil(this.userUid)) {
                throw Boom.badRequest('Mission access must be granted to community or user');
            } else if (!_.isNil(this.communityUid) && !_.isNil(this.userUid)) {
                throw Boom.badRequest('Mission access can only be granted to either community or user');
            }
        }
    }
})
export class MissionAccess extends Model {
    /**
     * Associations of the mission access model
     *
     * @static
     * @type {{
     *         community: BelongsTo,
     *         mission: BelongsTo,
     *         user: BelongsTo
     *     }}
     * @memberof MissionAccess
     */
    public static associations: {
        community: BelongsTo;
        mission: BelongsTo;
        user: BelongsTo;
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the mission access in the database
     *
     * @type {string}
     * @memberof MissionAccess
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * UID of the community to grant access to.
     * Can be `null` if the access was granted to an user instead of a community
     *
     * @type {string}
     * @memberof MissionAccess
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
            model: Community,
            key: 'uid'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })
    public communityUid: string | null;

    /**
     * Eager-loaded community instance.
     * Only included if access was granted to a community and it has been eager-loaded via sequelize
     *
     * @type {(Community | undefined | null)}
     * @memberof MissionAccess
     */
    public community?: Community;

    /**
     * UID of the mission to grant access to.
     *
     * @type {string}
     * @memberof MissionAccess
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Mission,
            key: 'uid'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })
    public missionUid: string;

    /**
     * Eager-loaded mission instance.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(Mission | undefined)}
     * @memberof MissionAccess
     */
    public mission?: Mission;

    /**
     * UID of the user to grant access to.
     * Can be `null` if the access was granted to a community instead of an user
     *
     * @type {string}
     * @memberof MissionAccess
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
            model: User,
            key: 'uid'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })
    public userUid: string | null;

    /**
     * Eager-loaded user instance.
     * Only included if access was granted to a user and it has been eager-loaded via sequelize
     *
     * @type {(User | undefined | null)}
     * @memberof MissionAccess
     */
    public user?: User;

    /**
     * Time (and date) the mission access instance was created
     *
     * @type {Date}
     * @memberof MissionAccess
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the mission access instance was last updated
     *
     * @type {Date}
     * @memberof MissionAccess
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
     * Retrieves the instance of the community access was granted to.
     * Only returns a result if access was granted to a community instead of an user
     *
     * @type {BelongsToGetAssociationMixin<Community>}
     * @returns {Promise<Community>} Community instance
     * @memberof MissionAccess
     */
    public getCommunity: BelongsToGetAssociationMixin<Community>;

    /**
     * Retrieves the instance of the mission access was granted to.
     *
     * @type {BelongsToGetAssociationMixin<Mission>}
     * @returns {Promise<Mission>} Mission instance
     * @memberof MissionAccess
     */
    public getMission: BelongsToGetAssociationMixin<Mission>;

    /**
     * Retrieves the instance of the user access was granted to.
     * Only returns a result if access was granted to an user instead of a community
     *
     * @type {BelongsToGetAssociationMixin<User>}
     * @returns {Promise<User>} User instance
     * @memberof MissionAccess
     */
    public getUser: BelongsToGetAssociationMixin<User>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the mission access instance, as transmitted via API
     *
     * @returns {Promise<IPublicMissionAccess>} Object containing public mission access information
     * @memberof MissionAccess
     */
    public async toPublicObject(): Promise<IPublicMissionAccess> {
        let publicCommunity: IPublicCommunity | undefined;
        if (!_.isNil(this.communityUid)) {
            if (_.isNil(this.community)) {
                this.community = await this.getCommunity();
            }

            publicCommunity = await this.community.toPublicObject();
        }

        let publicUser: IPublicUser | undefined;
        if (!_.isNil(this.userUid)) {
            if (_.isNil(this.user)) {
                this.user = await this.getUser();
            }

            publicUser = await this.user.toPublicObject();
        }

        return {
            uid: this.uid,
            community: publicCommunity,
            missionUid: this.missionUid,
            user: publicUser
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public mission access information as transmitted via API
 *
 * @export
 * @interface IPublicMissionAccess
 */
export interface IPublicMissionAccess {
    uid: string;
    community?: IPublicCommunity;
    missionUid: string;
    user?: IPublicUser;
}
