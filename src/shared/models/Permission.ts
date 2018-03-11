import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';

import { IPublicUser, User } from './User';

/**
 * Represents a permission in database.
 * Provides database access and utility functionality for permission instances
 *
 * @export
 * @class Permission
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'permissions',
    paranoid: false,
    indexes: [
        {
            name: 'permissions_unique_userUid_permission',
            fields: ['userUid', 'permission'],
            unique: true
        }
    ]
})
export class Permission extends Model {
    /**
     * Associations of the permission model
     *
     * @static
     * @type {{
     *         user: BelongsTo
     *     }}
     * @memberof Permission
     */
    public static associations: {
        user: BelongsTo;
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the permission in the database
     *
     * @type {string}
     * @memberof Permission
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Permission string granted to the user.
     * Uses dotted notation (e.g. community.test-community.leader), also supporting wildcards (e.g. admin.*)
     *
     * @type {string}
     * @memberof Permission
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public permission: string;

    /**
     * UID of the user the permission was granted for
     *
     * @type {string}
     * @memberof Permission
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
     * Eager-loaded user instance the permission was granted for.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(User | undefined)}
     * @memberof Permission
     */
    public user?: User;

    /**
     * Time (and date) the permission instance was created
     *
     * @type {Date}
     * @memberof Permission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the permission instance was last updated
     *
     * @type {Date}
     * @memberof Permission
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
     * Retrieves the permissions's user instance
     *
     * @type {BelongsToGetAssociationMixin<User>}
     * @returns {Promise<User>} User instance
     * @memberof Permission
     */
    public getUser: BelongsToGetAssociationMixin<User>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    /**
     * Checks whether the provided permission is valid for the given community.
     * Prevents granting of invalid permissions via direct API requests
     *
     * @param {string} communitySlug Slug of community to check permission for
     * @param {string} permission Permission to check
     * @returns {boolean} Indicates whether the permission is valid
     * @memberof Permission
     */
    // tslint:disable-next-line:function-name
    public static isValidCommunityPermission(communitySlug: string, permission: string): boolean {
        const perm = permission.toLowerCase();

        return perm === `community.${communitySlug}.leader` || perm === `community.${communitySlug}.recruitment`;
    }

    /**
     * Checks whether the provided permission is valid for the given mission.
     * Prevents granting of invalid permissions via direct API requests
     *
     * @param {string} missionSlug Slug of mission to check permission for
     * @param {string} permission Permission to check
     * @returns {boolean} Indicates whether the permission is valid
     * @memberof Permission
     */
    // tslint:disable-next-line:function-name
    public static isValidMissionPermission(missionSlug: string, permission: string): boolean {
        const perm = permission.toLowerCase();

        return perm === `mission.${missionSlug}.editor` || perm === `mission.${missionSlug}.slotlist.community`;
    }

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the permission instance, as transmitted via API
     *
     * @returns {Promise<IPublicPermission>} Object containing public permission information
     * @memberof Permission
     */
    public async toPublicObject(): Promise<IPublicPermission> {
        if (_.isNil(this.user)) {
            this.user = await this.getUser();
        }
        const publicUser = await this.user.toPublicObject();

        return {
            uid: this.uid,
            permission: this.permission,
            user: publicUser
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public permission information as transmitted via API
 *
 * @export
 * @interface IPublicPermission
 */
export interface IPublicPermission {
    uid: string;
    permission: string;
    user: IPublicUser;
}
