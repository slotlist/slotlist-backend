import * as _ from 'lodash';
import * as Sequelize from 'sequelize';

import slug from '../util/slug';

/**
 * Creates table for Mission model
 */
module.exports = {
    // tslint:disable-next-line:max-func-body-length
    up: async (queryInterface: Sequelize.QueryInterface): Promise<void> => {
        await queryInterface.createTable('missions', {
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
                // tslint:disable
                set(val: any) {
                    if (!_.isString(val)) {
                        throw new Error('Mission slug must be a string');
                    }

                    (<any>this).setDataValue('slug', slug(val));
                }
                // tslint:enable
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
                    // tslint:disable
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
                    // tslint:enable
                }
            },
            endTime: {
                type: Sequelize.DATE,
                allowNull: false,
                validate: {
                    // tslint:disable
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
                    // tslint:enable
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
            },
            initiatorUid: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'uid'
                }
            },
            communityUid: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'communities',
                    key: 'uid'
                }
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
    },
    down: async (queryInterface: Sequelize.QueryInterface): Promise<void> => {
        await queryInterface.dropTable('missions');
    }
};
