import { QueryTypes } from 'sequelize';

/**
 * Removes unique index for nickname column of users table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.sequelize.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_nickname_key;', { type: QueryTypes.RAW });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.addIndex('users', {
            name: 'users_nickname_key',
            fields: ['nickname'],
            unique: true
        });
    }
};
