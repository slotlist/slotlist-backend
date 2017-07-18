import * as _ from 'lodash';
import * as Sequelize from 'sequelize';

import slug from '../util/slug';

/**
 * Creates table for Community model
 */
module.exports = {
    up: async (queryInterface: Sequelize.QueryInterface): Promise<void> => {
        await queryInterface.createTable('communities', {
            uid: {
                type: Sequelize.UUID,
                allowNull: false,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            tag: {
                type: Sequelize.STRING,
                allowNull: false
            },
            website: {
                type: Sequelize.STRING,
                allowNull: true,
                defaultValue: null
            },
            slug: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
                // tslint:disable
                set(val: any) {
                    if (!_.isString(val)) {
                        throw new Error('Community slug must be a string');
                    }

                    (<any>this).setDataValue('slug', slug(val));
                }
                // tslint:enable
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            deletedAt: {
                type: Sequelize.DATE,
                allowNull: true,
                defaultValue: null
            }
        });
    },
    down: async (queryInterface: Sequelize.QueryInterface): Promise<void> => {
        await queryInterface.dropTable('communities');
    }
};
