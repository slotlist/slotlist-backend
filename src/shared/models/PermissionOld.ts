import * as Sequelize from 'sequelize';

import { IDefaultModelAttributes, IModels } from '../services/Storage';

import { IUser, IUserPrimaryKey } from './User';

export type IPermissionPrimaryKey = string;

export interface IPermissionAttributes extends IDefaultModelAttributes {
    uid: IPermissionPrimaryKey;
    permission: string;
    user?: IUser;
    userUid: IUserPrimaryKey;
}

export interface IPublicPermissionAttributes {
    uid: IPermissionPrimaryKey;
}
export type IPublicPermission = IPublicPermissionAttributes;

export interface IPermissionInstance extends Sequelize.Instance<IPermissionAttributes>, IPermissionAttributes {
    getUser: Sequelize.BelongsToGetAssociationMixin<IUser>;

    toPublicObject(): Promise<IPublicPermission>;
}
export type IPermission = IPermissionInstance;

// tslint:disable-next-line:no-empty-interface
export interface IPermissionModel extends Sequelize.Model<IPermissionInstance, Partial<IPermissionAttributes>> {

}

type IPermissionAssociations = {
    User: any
};

// tslint:disable-next-line:prefer-const
let associations: IPermissionAssociations;

export function getAssociations(): IPermissionAssociations {
    return associations;
}

/**
 * Sequelize model representing a Permission
 *
 * @export
 * @param {Sequelize.Sequelize} sequelize Sequelize instance
 */
export default function createPermissionModel(sequelize: Sequelize.Sequelize): Sequelize.Model<IPermissionInstance, IPermissionAttributes> {
    // tslint:disable
    const Permission: any = sequelize.define<IPermissionInstance, IPermissionAttributes>('permission', {
        uid: {
            type: Sequelize.UUID,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true
        },
        permission: {
            type: Sequelize.STRING,
            allowNull: false
        }
    }, {
            paranoid: false,
            indexes: [
                {
                    name: 'permissions_unique_userUid_permission',
                    fields: ['userUid', 'permission'],
                    unique: true
                }
            ]
        });

    // Class methods
    Permission.associate = function (models: IModels): void {
        associations = {
            User: Permission.belongsTo(models.User, {
                as: 'user',
                foreignKey: 'userUid'
            })
        }
    }

    // Instance methods
    Permission.prototype.toPublicObject = async function (): Promise<IPublicPermission> {
        const instance: IPermission = this;

        return {
            uid: instance.uid
        }
    }

    // tslint:enable
    return Permission;
}
