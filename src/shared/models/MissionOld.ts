import * as _ from 'lodash';
import * as Sequelize from 'sequelize';

import { IDefaultModelAttributes, IModels } from '../services/Storage';
import slug from '../util/slug';

import { ICommunity, ICommunityPrimaryKey } from './Community';
import { IUser, IUserPrimaryKey } from './User';

export type IMissionPrimaryKey = string;

export interface IMissionAttributes extends IDefaultModelAttributes {
    uid: IMissionPrimaryKey;
    title: string;
    slug: string;
    description: string;
    shortDescription: string;
    briefingTime: Date;
    slottingTime: Date;
    startTime: Date;
    endTime: Date;
    repositoryUrl?: string;
    techSupport?: string;
    rules?: string;
    initiator?: IUser;
    initiatorUid: IUserPrimaryKey;
    community?: ICommunity;
    communityUid: ICommunityPrimaryKey;
}

export interface IPublicMissionAttributes {
    uid: IMissionPrimaryKey;
    title: string;
    slug: string;
}
export type IPublicMission = IPublicMissionAttributes;

export interface IMissionInstance extends Sequelize.Instance<IMissionAttributes>, IMissionAttributes {
    getCommunity: Sequelize.BelongsToGetAssociationMixin<ICommunity>;
    getInitiator: Sequelize.BelongsToGetAssociationMixin<IUser>;

    toPublicObject(): Promise<IPublicMission>;
}
export type IMission = IMissionInstance;

// tslint:disable-next-line:no-empty-interface
export interface IMissionModel extends Sequelize.Model<IMissionInstance, Partial<IMissionAttributes>> {
    isSlugAvailable(newSlug: string): Promise<boolean>;
}

type IMissionAssociations = {
    Community: any,
    Initiator: any
};

// tslint:disable-next-line:prefer-const
let associations: IMissionAssociations;

export function getAssociations(): IMissionAssociations {
    return associations;
}

/**
 * Sequelize model representing a Mission
 *
 * @export
 * @param {Sequelize.Sequelize} sequelize Sequelize instance
 */
export default function createMissionModel(sequelize: Sequelize.Sequelize): Sequelize.Model<IMissionInstance, IMissionAttributes> {
    // tslint:disable
    const Mission: any = sequelize.define<IMissionInstance, IMissionAttributes>('mission', {
        uid: {
            type: Sequelize.UUID,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true
        },
        title: {
            type: Sequelize.STRING,
            allowNull: false
        },
        slug: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
            set(val: any) {
                if (!_.isString(val)) {
                    throw new Error('Mission slug must be a string');
                }

                (<any>this).setDataValue('slug', slug(val));
            }
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        shortDescription: {
            type: Sequelize.TEXT,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        briefingTime: {
            type: Sequelize.DATE,
            allowNull: false
        },
        slottingTime: {
            type: Sequelize.DATE,
            allowNull: false
        },
        startTime: {
            type: Sequelize.DATE,
            allowNull: false,
            validate: {
                isAfterSlottingTime(val: any) {
                    let start: Date;
                    if (_.isDate(val)) {
                        start = val;
                    } else if (_.isNumber(val) || _.isString(val)) {
                        start = new Date(val);
                    } else {
                        throw new Error('Mission startTime must be a Date, number or string');
                    }

                    if (start < (<Date>this.slottingTime)) {
                        throw new Error('Mission startTime must be after slottingTime')
                    }
                }
            }
        },
        endTime: {
            type: Sequelize.DATE,
            allowNull: false,
            validate: {
                isAfterStartTime(val: any) {
                    let end: Date;
                    if (_.isDate(val)) {
                        end = val;
                    } else if (_.isNumber(val) || _.isString(val)) {
                        end = new Date(val);
                    } else {
                        throw new Error('Mission endTime must be a Date, number or string');
                    }

                    if (end < (<Date>this.startTime)) {
                        throw new Error('Mission endTime must be after startTime')
                    }
                }
            }
        },
        repositoryUrl: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: null
        },
        techSupport: {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: null
        },
        rules: {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: null
        }
    }, {
            paranoid: false
        });

    // Class methods
    Mission.associate = function (models: IModels): void {
        associations = {
            Community: Mission.belongsTo(models.Community, {
                as: 'community',
                foreignKey: 'communityUid'
            }),
            Initiator: Mission.belongsTo(models.User, {
                as: 'initiator',
                foreignKey: 'initiatorUid'
            })
        }
    }

    Mission.isSlugAvailable = async function (newSlug: string): Promise<boolean> {
        const mission = await Mission.findOne({
            where: { slug: slug(newSlug) },
            attributes: ['slug']
        });

        return _.isNil(mission);
    }

    // Instance methods
    Mission.prototype.toPublicObject = async function (): Promise<IPublicMission> {
        const instance: IMission = this;

        return {
            uid: instance.uid,
            title: instance.title,
            slug: instance.slug
        }
    }

    // tslint:enable
    return Mission;
}
