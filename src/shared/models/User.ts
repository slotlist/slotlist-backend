import * as jwt from 'jsonwebtoken';
import * as moment from 'moment';
import * as Sequelize from 'sequelize';

import { JWT as JWTConfig } from '../config/Config';
import { IDefaultParanoidModelAttributes } from '../services/Storage';
import { log } from '../util/log';

export type IUserPrimaryKey = string;

export interface IUserAttributes extends IDefaultParanoidModelAttributes {
    uid: IUserPrimaryKey;
    nickname: string;
    steamID: string;
}

export interface IUserInstance extends Sequelize.Instance<IUserAttributes>, IUserAttributes {

}
export type IUser = IUserInstance;

export interface IPublicUserInstance {
    uid: IUserPrimaryKey;
    nickname: string;
}
export type IPublicUser = IPublicUserInstance;

// tslint:disable-next-line:no-empty-interface
export interface IUserModel extends Sequelize.Model<IUserInstance, Partial<IUserAttributes>> {

}

type IUserAssociations = {

};

// tslint:disable-next-line:prefer-const
let associations: IUserAssociations;

export function getAssociations(): IUserAssociations {
    return associations;
}

/**
 * Sequelize model representing a user
 *
 * @export
 * @param {Sequelize.Sequelize} sequelize Sequelize instance
 */
export default function createUserModel(sequelize: Sequelize.Sequelize): Sequelize.Model<IUserInstance, IUserAttributes> {
    // tslint:disable
    const User: any = sequelize.define<IUserInstance, IUserAttributes>("User", {
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
        steamID: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        }
    }, {
            indexes: [

            ]
        });

    // Class methods

    // Instance methods
    User.prototype.generateJWT = function (): string {
        const instance: IUserInstance = this;

        const payload = {
            uid: instance.uid,
            nickname: instance.nickname
        };

        const jwtSignOptions: jwt.SignOptions = {
            algorithm: JWTConfig.algorithms[0],
            audience: JWTConfig.audience,
            expiresIn: JWTConfig.expiresIn,
            issuer: JWTConfig.issuer,
            subject: instance.uid,
            notBefore: moment.utc().seconds().toString()
        };

        log.debug({ user: instance, jwtSignOptions }, 'Generating JWT for user');

        const token = jwt.sign(payload, JWTConfig.secret, jwtSignOptions);

        return token;
    }

    User.prototype.toPublicObject = function (): IPublicUser {
        const instance: IUserInstance = this;

        return {
            uid: instance.uid,
            nickname: instance.nickname
        }
    }

    // tslint:enable
    return User;
}
