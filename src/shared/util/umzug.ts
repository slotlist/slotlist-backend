import * as path from 'path';
import { Transaction } from 'sequelize';
// tslint:disable-next-line: no-require-imports no-var-requires variable-name
const Umzug = require('umzug');

import { log as logger } from './log';
import sequelize from './sequelize';
const log = logger.child({ umzug: true });

/**
 * Creates a new umzug instance and allows migrations to be exectuted
 */

export const umzug = new Umzug({
    logging: (message: any) => {
        log.info(message);
    },
    migrations: {
        params: [
            sequelize.getQueryInterface()
        ],
        path: path.resolve(__dirname, '../migrations'),
        pattern: /^\d+[\w-]+\.js$/
    },
    storage: 'sequelize',
    storageOptions: {
        sequelize: sequelize
    }
});

export async function migrateUp(all: boolean = true): Promise<void> {
    await sequelize.transaction(async (transaction: Transaction) => {
        let pendingMigrations = await umzug.pending();

        if (!all && pendingMigrations.length > 1) {
            pendingMigrations = [pendingMigrations[0]];
        }

        return Promise.each(pendingMigrations, (migration: any) => {
            const migrationName = migration.file.split(':')[0];

            return umzug.up(migrationName);
        });
    });
}

export async function migrateDown(all: boolean = true): Promise<void> {
    await sequelize.transaction(async (transaction: Transaction) => {
        return umzug.down();
    });
}

export default umzug;
