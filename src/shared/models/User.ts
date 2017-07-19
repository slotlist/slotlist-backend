import * as jwt from 'jsonwebtoken';
import * as _ from 'lodash';
import * as moment from 'moment';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    HasMany,
    HasManyCreateAssociationMixin,
    HasManyGetAssociationsMixin,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import { JWT as JWTConfig } from '../config/Config';
import { log as logger } from '../util/log';
import sequelize from '../util/sequelize';

const log = logger.child({ model: 'User' });

/**
 * Represents a user in database
 * Provides database access and utility functionality for user instances
 *
 * @export
 * @class User
 * @extends {Model}
 */
@Options({
    sequelize,
    tableName: 'users',
    paranoid: true
})
export class User extends Model {
    /**
     * Associations of the user model
     *
     * @static
     * @type {{
     *         community: BelongsTo,
     *         permissions: HasMany
     *     }}
     * @memberof User
     */
    public static associations: {
        community: BelongsTo,
        permissions: HasMany
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the user in the database
     *
     * @type {string}
     * @memberof User
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Nickname of the user
     * Initially retrieved via Steam API upon user creation, can be changed by user though
     *
     * @type {string}
     * @memberof User
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false
    })
    public nickname: string;

    /**
     * SteamID (Steam 64 ID) of user
     * Used to identify and log in a user via Steam SSO
     *
     * @type {string}
     * @memberof User
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    })
    public steamId: string;

    /**
     * UUID of the community the user is associated with
     * Can be `undefined|null` if the user has not been assigned to a community
     *
     * @type {string|undefined|null}
     * @memberof User
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'communities',
            key: 'uid'
        },
        onDelete: 'SET NULL'
    })
    public communityUid?: string;

    /**
     * Eager-loaded community instance
     * Only included if the user is associated with a community and it has been eager-loaded via sequelize
     *
     * @type {Community|undefined}
     * @memberof User
     */
    public community?: Community;

    /**
     * Eager-loaded list of permissions associated with the user
     * Only included if the user has permissions associated and it has been eager-loaded via sequelize
     *
     * @type {Permission[]|undefined}
     * @memberof User
     */
    public permissions?: Permission[];

    ////////////////////////////
    // Sequelize model mixins //
    ////////////////////////////

    /**
     * Creates a new permission for the user
     * The new permission automatically gets associated with the user (userUid does not have to be provided)
     *
     * @type {HasManyCreateAssociationMixin<Permission>}
     * @returns {Promise<Permission>} Instance of created permission
     * @memberof User
     */
    public createPermission: HasManyCreateAssociationMixin<Permission>;

    /**
     * Retrieves the user's community instance
     * Only returns a result if the user has been associated with a community
     *
     * @type {BelongsToGetAssociationMixin<Community>}
     * @returns {Promise<Community>} Community the user is associated with
     * @memberof User
     */
    public getCommunity: BelongsToGetAssociationMixin<Community>;

    /**
     * Retrieves the user's permissions
     * Returns an empty array if the user has no permissions assigned
     *
     * @type {HasManyGetAssociationsMixin<Permission>}
     * @returns {Promise<Permission[]>} List of user permissions
     * @memberof User
     */
    public getPermissions: HasManyGetAssociationsMixin<Permission>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Generates a JWT containing relevant user information
     *
     * @returns {Promise<string>} Signed JSON Web Token
     * @memberof User
     */
    public async generateJWT(): Promise<string> {
        log.debug({ function: 'generateJWT', userUid: this.uid }, 'Generating JWT for user');
        log.debug({ function: 'generateJWT', userUid: this.uid }, 'Retrieving user permissions');

        const permissions = await this.getPermissions();

        const payload = {
            user: {
                uid: this.uid,
                nickname: this.nickname
            },
            permissions: _.map(permissions, 'permission')
        };

        const jwtSignOptions: jwt.SignOptions = {
            algorithm: JWTConfig.algorithms[0],
            audience: JWTConfig.audience,
            expiresIn: JWTConfig.expiresIn,
            issuer: JWTConfig.issuer,
            subject: this.uid,
            notBefore: moment.utc().seconds().toString()
        };

        log.debug({ function: 'generateJWT', userUid: this.uid, jwtSignOptions }, 'Signing JWT for user');

        const token = jwt.sign(payload, JWTConfig.secret, jwtSignOptions);

        log.debug({ function: 'generateJWT', userUid: this.uid, jwtSignOptions }, 'Successfully finished generating JWT for user');

        return token;
    }

    /**
     * Checks whether the user has the permissions provided
     * Permission check also includes wildcards (in granted permissions) and can check for multiple permissions at once
     *
     * @param {(string | string[])} permission Permission or array of multiple permissions to check for. Uses dotted notation
     * @param {boolean} [strict=false] Indicates whether found permissions must exactly match required permissions
     * @returns {Promise<boolean>} Indicates whether the user has the required permissions assigned
     * @memberof User
     */
    public async hasPermission(permission: string | string[], strict: boolean = false): Promise<boolean> {
        log.debug({ function: 'hasPermission', userUid: this.uid, permission, strict }, 'Checking if user has permission');
        log.debug({ function: 'hasPermission', userUid: this.uid, permission, strict }, 'Retrieving user permissions');

        this.permissions = await this.getPermissions();
        if (!_.isArray(this.permissions) || _.isEmpty(this.permissions)) {
            log.debug({ function: 'hasPermission', userUid: this.uid, permission, strict }, 'User does not have any permissions, ending permission check');

            return false;
        }

        const permissions: string[] = <any>_.map(this.permissions, 'permission');
        const parsedPermissions: any = {};
        _.each(permissions, (perm: string) => {
            const permissionParts = perm.toLowerCase().split('.');

            let previous = parsedPermissions;
            let part = permissionParts.shift();
            while (!_.isNil(part)) {
                if (_.isNil(previous[part])) {
                    previous[part] = {};
                }

                previous = previous[part];
                part = permissionParts.shift();
            }
        });

        log.debug({ function: 'hasPermission', userUid: this.uid, permission, parsedPermissions, strict }, 'Parsed user permissions, checking for permission');

        const requiredPermissions: string[] = _.isArray(permission) ? permission : [permission];
        const foundPermissions: string[] = _.filter(requiredPermissions, (requiredPermission: string) => {
            return this.findPermission(parsedPermissions, requiredPermission);
        });

        const hasPermission = strict ? foundPermissions.length === requiredPermissions.length : foundPermissions.length > 0;

        log.debug({ function: 'hasPermission', userUid: this.uid, permission, strict, foundPermissions, hasPermission }, 'Successfully finished checking if user has permission');

        return hasPermission;
    }

    /**
     * Returns a public representation of the user instance, as transmitted via API
     *
     * @returns {Promise<IPublicUser>} Object containing public user information
     * @memberof User
     */
    public async toPublicObject(): Promise<IPublicUser> {
        return {
            uid: this.uid,
            nickname: this.nickname
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////

    /**
     * Recursive check for permission in permission tree
     *
     * @private
     * @param {*} permissions Permission tree to recurse through
     * @param {(string | string[])} permission Permission to check for (either as string or array of string split by `.`)
     * @returns {boolean} Indicates whether the permission was found
     * @memberof User
     */
    private findPermission(permissions: any, permission: string | string[]): boolean {
        if (_.isNil(permissions) || !_.isObject(permissions) || _.keys(permissions).length <= 0) {
            return false;
        }

        if (_.has(permissions, permission)) {
            return true;
        }

        return _.some(permissions, (next: any, current: string) => {
            const permParts = _.isString(permission) ? permission.toLowerCase().split('.') : permission;

            const permPart = permParts.shift();
            if (current === '*' || current === permPart) {
                if (permParts.length <= 0) {
                    return true;
                }

                return this.findPermission(next, _.clone(permParts));
            }

            return false;
        });
    }
}

/**
 * Public user information as transmitted via API
 *
 * @export
 * @interface IPublicUser
 */
export interface IPublicUser {
    uid: string;
    nickname: string;
}

/**
 * Model associations
 *
 * ATTENTION: absolutely **HAS** to be at the very end of the file and **AFTER** complete model definition, causes cyclic dependency hell otherwise
 * Imports of associated models **MUST NOT** be at the top of the file, but rather **HAVE TO BE** down here
 */

import { Community } from './Community';
import { Permission } from './Permission';

User.associations.community = User.belongsTo(Community, { as: 'community', foreignKey: 'communityUid' });
User.associations.permissions = User.hasMany(Permission, { as: 'permissions', foreignKey: 'userUid' });
