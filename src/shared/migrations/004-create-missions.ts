import * as Boom from 'boom';
import { DataTypes } from 'sequelize';

import slug from '../util/slug';

/**
 * Creates table for Mission model
 */
module.exports = {
    // tslint:disable-next-line:max-func-body-length
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.createTable('missions', {
            uid: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            slug: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: true
                },
                unique: true,
                // tslint:disable
                set(val: string) {
                    if (val === 'slugAvailable') {
                        throw Boom.badRequest('Disallowed slug');
                    }

                    (<any>this).setDataValue('slug', slug(val));
                }
                // tslint:enable
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            shortDescription: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            briefingTime: {
                type: DataTypes.DATE,
                allowNull: false
            },
            slottingTime: {
                type: DataTypes.DATE,
                allowNull: false
            },
            startTime: {
                type: DataTypes.DATE,
                allowNull: false,
                validate: {
                    // tslint:disable
                    afterSlottingTime(val: Date): void {
                        if (val < (<any>this).slottingTime) {
                            throw new Error('Mission startTime must be after slottingTime');
                        }
                    }
                    // tslint:enable
                }
            },
            endTime: {
                type: DataTypes.DATE,
                allowNull: false,
                validate: {
                    // tslint:disable
                    afterStartTime(val: Date): void {
                        if (val < (<any>this).startTime) {
                            throw new Error('Mission endTime must be after startTime');
                        }
                    }
                    // tslint:enable
                }
            },
            repositoryUrl: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: null,
                validate: {
                    notEmpty: true,
                    isUrl: true
                }
            },
            techSupport: {
                type: DataTypes.TEXT,
                allowNull: true,
                defaultValue: null
            },
            rules: {
                type: DataTypes.TEXT,
                allowNull: true,
                defaultValue: null
            },
            communityUid: {
                type: DataTypes.UUID,
                allowNull: true,
                defaultValue: null,
                references: {
                    model: 'communities',
                    key: 'uid'
                },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE'
            },
            creatorUid: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'uid'
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.dropTable('missions');
    }
};
