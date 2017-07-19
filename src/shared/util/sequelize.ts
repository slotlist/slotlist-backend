import { Sequelize } from 'sequelize';

import { Database as DatabaseConfig } from '../config/Config';
import { log } from './log';

/**
 * Creates a new sequelize instance and allows sharing across models
 */

const instance = new Sequelize(DatabaseConfig.database, DatabaseConfig.username, DatabaseConfig.password, {
    dialect: 'postgres',
    host: DatabaseConfig.host,
    logging: (msg: any) => {
        log.trace({ sequelize: true }, msg);
    },
    native: true,
    pool: {
        idle: 10000,
        max: 5,
        min: 0
    },
    port: DatabaseConfig.port,
    timezone: 'Etc/UCT'
});

export default instance;
