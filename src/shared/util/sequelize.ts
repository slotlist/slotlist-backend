import { Sequelize } from 'sequelize';

import { Database as DatabaseConfig } from '../config/Config';
import { log as logger } from './log';
const log = logger.child({ sequelize: true });

/**
 * Creates a new sequelize instance and allows sharing across models
 */

export const sequelize = new Sequelize(DatabaseConfig.database, DatabaseConfig.username, DatabaseConfig.password, {
    dialect: 'postgres',
    host: DatabaseConfig.host,
    logging: (msg: any) => {
        log.trace(msg);
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

export default sequelize;
