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

umzug.on('migrating', (name: string, migration: any) => log.info({ migrationName: name }, 'Started migration'));
umzug.on('migrated', (name: string, migration: any) => log.info({ migrationName: name }, 'Finished migration'));
umzug.on('reverting', (name: string, migration: any) => log.info({ migrationName: name }, 'Started reverting migration'));
umzug.on('reverted', (name: string, migration: any) => log.info({ migrationName: name }, 'Finished reverting migration'));

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
