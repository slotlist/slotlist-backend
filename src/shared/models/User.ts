import * as Boom from 'boom';
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
    HasManyRemoveAssociationMixin,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import { JWT as JWTConfig } from '../config/Config';
import { findPermission, parsePermissions } from '../util/acl';
import { log as logger } from '../util/log';
import sequelize from '../util/sequelize';
const log = logger.child({ model: 'User' });

import { Community, IPublicCommunity } from './Community';
import { CommunityApplication } from './CommunityApplication';
import { IPublicMission, Mission } from './Mission';
import { MissionAccess } from './MissionAccess';
import { MissionSlot } from './MissionSlot';
import { MissionSlotRegistration } from './MissionSlotRegistration';
import { MissionSlotTemplate } from './MissionSlotTemplate';
import { Permission } from './Permission';

/**
 * Represents a user in database.
 * Provides database access and utility functionality for user instances
 *
 * @export
 * @class User
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'users',
    paranoid: false
})
export class User extends Model {
    /**
     * Associations of the user model
     *
     * @static
     * @type {{
     *         applications: HasMany,
     *         community: BelongsTo,
     *         missionAccesses: HasMany,
     *         missions: HasMany,
     *         missionSlots: HasMany,
     *         missionSlotRegistrations: HasMany,
     *         missionSlotTemplates: HasMany,
     *         notifications: HasMany,
     *         permissions: HasMany
     *     }}
     * @memberof User
     */
    public static associations: {
        applications: HasMany;
        community: BelongsTo;
        missionAccesses: HasMany;
        missions: HasMany;
        missionSlots: HasMany;
        missionSlotRegistrations: HasMany;
        missionSlotTemplates: HasMany;
        notifications: HasMany;
        permissions: HasMany;
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
     * Nickname of the user.
     * Initially retrieved via Steam API upon user creation, can be changed by user though
     *
     * @type {string}
     * @memberof User
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public nickname: string;

    /**
     * SteamID (Steam 64 ID) of user.
     * Used to identify and log in a user via Steam SSO
     *
     * @type {string}
     * @memberof User
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true
        }
    })
    public steamId: string;

    /**
     * UID of the community the user is associated with.
     * Can be `undefined|null` if the user has not been assigned to a community
     *
     * @type {(string | null)}
     * @memberof User
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
     * Eager-loaded list of community application instances.
     * Only included if the user has applications associated and it has been eager-loaded via sequelize
     *
     * @type {(CommunityApplication[] | undefined)}
     * @memberof User
     */
    public applications?: CommunityApplication[];

    /**
     * Eager-loaded community instance.
     * Only included if the user is associated with a community and it has been eager-loaded via sequelize
     *
     * @type {(Community | null | undefined)}
     * @memberof User
     */
    public community?: Community | null;

    /**
     * Eager-loaded list mission accesses granted to the user.
     * Only included if the user has accesses granted and it has been eager-loaded via sequelize
     *
     * @type {(MissionAccess[] | undefined)}
     * @memberof User
     */
    public missionAccesses?: MissionAccess[];

    /**
     * Eager-loaded list of missions created by the user.
     * Only included if the user has missions associated and it has been eager-loaded via sequelize
     *
     * @type {(Mission[] | undefined)}
     * @memberof User
     */
    public missions?: Mission[];

    /**
     * Eager-loaded list of missions slots assigned to the user.
     * Only included if the user has mission slots associated and it has been eager-loaded via sequelize
     *
     * @type {(MissionSlot[] | undefined)}
     * @memberof User
     */
    public missionSlots?: MissionSlot[];

    /**
     * Eager-loaded list of mission slot registrations assigned to the user.
     * Only included if the user has mission slot registrations associated and it has been eager-loaded via sequelize
     *
     * @type {(MissionSlotRegistration[] | undefined)}
     * @memberof User
     */
    public missionSlotRegistrations?: MissionSlotRegistration[];

    /**
     * Eager-loaded list of mission slot templates created by the user.
     * Only included if the user has created mission slot templates and it has been eager-loaded via sequelize
     *
     * @type {(MissionSlotTemplate[] | undefined)}
     * @memberof User
     */
    public missionSlotTemplates?: MissionSlotTemplate[];

    /**
     * Eager-loaded list of permissions associated with the user.
     * Only included if the user has permissions associated and it has been eager-loaded via sequelize
     *
     * @type {(Permission[] | undefined)}
     * @memberof User
     */
    public permissions?: Permission[];

    /**
     * Indicates whether the user account is active and can thus make requests.
     * This flag can be used to ban users from using the service - setting this to `false` will deny their login and thus only allow unauthenticated access
     *
     * @type {boolean}
     * @memberof User
     */
    @Attribute({
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    })
    public active: boolean;

    /**
     * Time (and date) the user instance was created
     *
     * @type {Date}
     * @memberof User
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the user instance was last updated
     *
     * @type {Date}
     * @memberof User
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
     * Creates a new permission for the user.
     * The new permission automatically gets associated with the user (userUid does not have to be provided)
     *
     * @type {HasManyCreateAssociationMixin<Permission>}
     * @returns {Promise<Permission>} Instance of created permission
     * @memberof User
     */
    public createPermission: HasManyCreateAssociationMixin<Permission>;

    /**
     * Retrieves the user's applications.
     * Returns an empty array if the user has no applications assigned
     *
     * @type {HasManyGetAssociationsMixin<CommunityApplication>}
     * @returns {Promise<CommunityApplication[]>} List of applications
     * @memberof User
     */
    public getApplications: HasManyGetAssociationsMixin<CommunityApplication>;

    /**
     * Retrieves the user's community instance.
     * Only returns a result if the user has been associated with a community
     *
     * @type {BelongsToGetAssociationMixin<Community>}
     * @returns {Promise<Community>} Community the user is associated with
     * @memberof User
     */
    public getCommunity: BelongsToGetAssociationMixin<Community>;

    /**
     * Retrieves the users's mission access instances.
     * Returns an empty array if the user has not been granted any mission access
     *
     * @type {HasManyGetAssociationsMixin<MissionAccess>}
     * @returns {Promise<MissionAccess[]>} List of mission accesses
     * @memberof User
     */
    public getMissionAccesses: HasManyGetAssociationsMixin<MissionAccess>;

    /**
     * Retrieves the user's missions.
     * Returns an empty array if the user has no missions assigned
     *
     * @type {HasManyGetAssociationsMixin<Mission>}
     * @returns {Promise<Mission[]>} List of missions
     * @memberof User
     */
    public getMissions: HasManyGetAssociationsMixin<Mission>;

    /**
     * Retrieves the user's assigned mission slots.
     * Returns an empty array if the user has no mission slots assigned
     *
     * @type {HasManyGetAssociationsMixin<MissionSlot>}
     * @returns {Promise<MissionSlot[]>} List of mission slots
     * @memberof User
     */
    public getMissionSlots: HasManyGetAssociationsMixin<MissionSlot>;

    /**
     * Retrieves the user's mission slot registrations.
     * Returns an empty array if the user has no mission slot registrations assigned
     *
     * @type {HasManyGetAssociationsMixin<MissionSlotRegistration>}
     * @returns {Promise<MissionSlotRegistration[]>} List of mission slot registrations
     * @memberof User
     */
    public getMissionSlotRegistrations: HasManyGetAssociationsMixin<MissionSlotRegistration>;

    /**
     * Retrieves the user's mission slot templates.
     * Returns an empty array if the user has created no mission slot templates
     *
     * @type {HasManyGetAssociationsMixin<MissionSlotTemplate>}
     * @returns {Promise<MissionSlotTemplate[]>} List of mission slot templates
     * @memberof User
     */
    public getMissionSlotTemplates: HasManyGetAssociationsMixin<MissionSlotTemplate>;

    /**
     * Retrieves the user's permissions.
     * Returns an empty array if the user has no permissions assigned
     *
     * @type {HasManyGetAssociationsMixin<Permission>}
     * @returns {Promise<Permission[]>} List of user permissions
     * @memberof User
     */
    public getPermissions: HasManyGetAssociationsMixin<Permission>;

    /**
     * Removes the given permission or a permission with the provided UID from the user
     *
     * @type {HasManyRemoveAssociationMixin<Permission, string>}
     * @returns {Promise<void>} Promise fulfilled when removal is completed
     * @memberof User
     */
    public removePermission: HasManyRemoveAssociationMixin<Permission, string>;

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
            user: await this.toPublicObject(),
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
     * Checks whether the user has the permissions provided.
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

        const permissions: string[] = _.map(this.permissions, 'permission');
        const parsedPermissions = parsePermissions(permissions);
        if (_.has(parsedPermissions, '*')) {
            log.debug(
                { function: 'hasPermission', userUid: this.uid, permission, parsedPermissions, strict, hasPermission: true },
                'User has global wildcard permission, allowing');

            return true;
        }

        log.debug({ function: 'hasPermission', userUid: this.uid, permission, parsedPermissions, strict }, 'Parsed user permissions, checking for permission');

        const requiredPermissions: string[] = _.isArray(permission) ? permission : [permission];
        const foundPermissions: string[] = _.filter(requiredPermissions, (requiredPermission: string) => {
            return findPermission(parsedPermissions, requiredPermission);
        });

        const hasPermission = strict ? foundPermissions.length === requiredPermissions.length : foundPermissions.length > 0;

        log.debug({ function: 'hasPermission', userUid: this.uid, permission, strict, foundPermissions, hasPermission }, 'Successfully finished checking if user has permission');

        return hasPermission;
    }

    public async removePermissionByPermissionString(permission: string): Promise<void> {
        log.debug({ function: 'removePermissionByPermission', userUid: this.uid, permission }, 'Removing user permission by permission string');

        const destroyed = await Permission.destroy({
            where: {
                userUid: this.uid,
                permission: permission
            }
        });

        if (destroyed <= 0) {
            log.debug({ function: 'removePermissionByPermission', userUid: this.uid, permission }, 'Failed to remove user permission by permission string, not found');
            throw Boom.notFound('Permission not found', { userUid: this.uid, permission });
        }

        log.debug({ function: 'removePermissionByPermission', userUid: this.uid, permission, destroyed }, 'Successfully removed user permission by permission string');
    }

    /**
     * Returns a public representation of the user instance, as transmitted via API
     *
     * @param {boolean} [includeAdminDetails=false] Allows for admin details such as Steam ID and `active` status to be included
     * @returns {Promise<IPublicUser>} Object containing public user information
     * @memberof User
     */
    public async toPublicObject(includeAdminDetails: boolean = false): Promise<IPublicUser> {
        let publicCommunity: IPublicCommunity | null = null;
        if (!_.isNil(this.communityUid)) {
            if (_.isNil(this.community)) {
                this.community = await this.getCommunity();
            }
            publicCommunity = await this.community.toPublicObject();
        }

        return {
            uid: this.uid,
            nickname: this.nickname,
            community: publicCommunity,
            steamId: includeAdminDetails ? this.steamId : undefined,
            active: includeAdminDetails ? this.active : undefined
        };
    }

    /**
     * Returns a detailed public representation of the user instance, as transmitted via API.
     * Also includes missions created by the user as well as the community the user belongs to
     *
     * @param {boolean} [includeAdminDetails=false] Allows for admin details such as Steam ID and `active` status to be included
     * @returns {Promise<IDetailedPublicUser>} Object containing detailed public user information
     * @memberof User
     */
    public async toDetailedPublicObject(includeAdminDetails: boolean = false): Promise<IDetailedPublicUser> {
        if (!_.isNil(this.communityUid)) {
            if (_.isNil(this.community)) {
                this.community = await this.getCommunity();
            }
        }

        if (_.isNil(this.missions)) {
            this.missions = await this.getMissions();
        }

        const [publicCommunity, publicMissions] = await Promise.all([
            !_.isNil(this.communityUid) && !_.isNil(this.community) ? this.community.toPublicObject() : Promise.resolve(null),
            Promise.map(this.missions, (mission: Mission) => {
                return mission.toPublicObject();
            })
        ]);

        return {
            uid: this.uid,
            nickname: this.nickname,
            community: publicCommunity,
            missions: publicMissions,
            steamId: includeAdminDetails ? this.steamId : undefined,
            active: includeAdminDetails ? this.active : undefined
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////

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
    community: IPublicCommunity | null;
    steamId?: string;
    active?: boolean;
}

/**
 * Detailed public user information as transmitted via API.
 * Also includes missions created by the user as well as the community the user belongs to
 *
 * @export
 * @interface IDetailedPublicUser
 * @extends {IPublicUser}
 */
export interface IDetailedPublicUser extends IPublicUser {
    missions: IPublicMission[];
}
