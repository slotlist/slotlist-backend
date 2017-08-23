import { Sequelize } from 'sequelize';

import { Database as DatabaseConfig } from '../config/Config';
import { log as logger } from './log';
const log = logger.child({ sequelize: true });

/**
 * Creates a new sequelize instance and allows sharing across models
 */

const options: any = {
    benchmark: true,
    dialect: 'postgres',
    host: DatabaseConfig.host,
    logging: (msg: any, executionTime: any) => {
        log.trace({ executionTime }, msg);
    },
    native: true,
    pool: {
        idle: 10000,
        max: 5,
        min: 0
    },
    port: DatabaseConfig.port,
    timezone: 'Etc/UTC'
};

export const sequelize = new Sequelize(DatabaseConfig.database, DatabaseConfig.username, DatabaseConfig.password, options);

export default sequelize;
