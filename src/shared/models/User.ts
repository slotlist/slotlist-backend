import * as jwt from 'jsonwebtoken';
import * as _ from 'lodash';
import * as moment from 'moment';
import * as Sequelize from 'sequelize';

import { JWT as JWTConfig } from '../config/Config';
import { IDefaultParanoidModelAttributes, IModels } from '../services/Storage';
import { log as logger } from '../util/log';
const log = logger.child({ model: 'User' });

import { ICommunity, ICommunityPrimaryKey } from './Community';
import { IMission } from './Mission';
import { IPermission, IPermissionAttributes } from './Permission';

export type IUserPrimaryKey = string;

export interface IUserAttributes extends IDefaultParanoidModelAttributes {
    uid: IUserPrimaryKey;
    nickname: string;
    steamId: string;
    Community?: ICommunity;
    CommunityUid?: ICommunityPrimaryKey;
    Permissions?: IPermission[];
}

export interface IPublicUserAttributes {
    uid: IUserPrimaryKey;
    nickname: string;
}
export type IPublicUser = IPublicUserAttributes;

export interface IUserInstance extends Sequelize.Instance<IUserAttributes>, IUserAttributes {
    createPermission: Sequelize.BelongsToCreateAssociationMixin<Partial<IPermissionAttributes>>;
    getCommunity: Sequelize.BelongsToGetAssociationMixin<ICommunity>;
    getMissions: Sequelize.HasManyGetAssociationsMixin<IMission>;
    getPermissions: Sequelize.HasManyGetAssociationsMixin<IPermission>;

    generateJWT(): string;
    hasPermission(permission: string | string[]): Promise<boolean>;
    toPublicObject(): Promise<IPublicUser>;
}
export type IUser = IUserInstance;

// tslint:disable-next-line:no-empty-interface
export interface IUserModel extends Sequelize.Model<IUserInstance, Partial<IUserAttributes>> {

}

type IUserAssociations = {
    Community: any,
    Missions: any,
    Permissions: any
};

// tslint:disable-next-line:prefer-const
let associations: IUserAssociations;

export function getAssociations(): IUserAssociations {
    return associations;
}

const findPermission = (permissions: any, permission: string | string[]): boolean => {
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

            return findPermission(next, _.clone(permParts));
        }

        return false;
    });
};

/**
 * Sequelize model representing a user
 *
 * @export
 * @param {Sequelize.Sequelize} sequelize Sequelize instance
 */
export default function createUserModel(sequelize: Sequelize.Sequelize): Sequelize.Model<IUserInstance, IUserAttributes> {
    // tslint:disable
    const User: any = sequelize.define<IUserInstance, IUserAttributes>('user', {
        uid: {
            type: Sequelize.UUID,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true
        },
        nickname: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        },
        steamId: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        }
    }, {
            paranoid: true
        });

    // Class methods
    User.associate = function (models: IModels): void {
        associations = {
            Community: User.belongsTo(models.Community, {
                as: 'community',
                foreignKey: 'communityUid'
            }),
            Missions: User.hasMany(models.Mission, {
                as: 'missions',
                foreignKey: 'initiatorUid'
            }),
            Permissions: User.hasMany(models.Permission, {
                as: 'permissions',
                foreignKey: 'userUid'
            })
        }
    }

    // Instance methods
    User.prototype.generateJWT = function (): string {
        const instance: IUserInstance = this;

        const payload = {
            user: {
                uid: instance.uid,
                nickname: instance.nickname
            },
            permissions: ['admin.panel', 'admin.*.read']
        };

        const jwtSignOptions: jwt.SignOptions = {
            algorithm: JWTConfig.algorithms[0],
            audience: JWTConfig.audience,
            expiresIn: JWTConfig.expiresIn,
            issuer: JWTConfig.issuer,
            subject: instance.uid,
            notBefore: moment.utc().seconds().toString()
        };

        log.debug({ function: 'generateJWT', user: instance, jwtSignOptions }, 'Generating JWT for user');

        const token = jwt.sign(payload, JWTConfig.secret, jwtSignOptions);

        return token;
    }

    User.prototype.hasPermission = async function (permission: string | string[], strict: boolean = false): Promise<boolean> {
        const instance: IUser = this;

        log.debug({ function: 'hasPermission', userUid: instance.uid, permission, strict }, 'Checking if user has permission');
        log.debug({ function: 'hasPermission', userUid: instance.uid, permission, strict }, 'Retrieving user permissions');

        instance.Permissions = await instance.getPermissions();
        if (!_.isArray(instance.Permissions) || _.isEmpty(instance.Permissions)) {
            log.debug({ function: 'hasPermission', userUid: instance.uid, permission, strict }, 'User does not have any permissions, ending permission check');

            return false;
        }

        const permissions: string[] = _.map(instance.Permissions, 'permission');
        const parsedPermissions: any = {};
        _.each(permissions, (permission) => {
            const permissionParts = permission.toLowerCase().split('.');

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

        log.debug({ function: 'hasPermission', userUid: instance.uid, permission, parsedPermissions, strict }, 'Parsed user permissions, checking for permission');

        const requiredPermissions = _.isArray(permission) ? permission : [permission];
        const foundPermissions: string[] = _.filter(requiredPermissions, (requiredPermission) => {
            return findPermission(parsedPermissions, requiredPermission);
        });

        const hasPermission = strict ? foundPermissions.length === requiredPermissions.length : foundPermissions.length > 0;

        log.debug({ function: 'hasPermission', userUid: instance.uid, permission, strict, foundPermissions, hasPermission }, 'Successfully finished checking if user has permission');

        return hasPermission;
    }

    User.prototype.toPublicObject = async function (): Promise<IPublicUser> {
        const instance: IUser = this;

        return {
            uid: instance.uid,
            nickname: instance.nickname
        }
    }

    // tslint:enable
    return User;
}
