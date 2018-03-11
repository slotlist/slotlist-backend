import * as _ from 'lodash';
import { DataTypes, QueryTypes } from 'sequelize';

/**
 * Adds the repositories columns to the Communities and Missions tables and migrates existing `repositoryUrl`s
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.addColumn('communities', 'repositories', {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: []
        });

        await queryInterface.addColumn('missions', 'repositories', {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: []
        });

        const existingRepositoryEntries = await queryInterface.sequelize.query(
            'SELECT "uid", "repositoryUrl" FROM "missions" WHERE "repositoryUrl" IS NOT NULL;',
            { type: QueryTypes.SELECT });

        await Promise.map(existingRepositoryEntries, (existingRepositoryEntry: any) => {
            const repositoryUrl = (<string>existingRepositoryEntry.repositoryUrl).replace(/[\\]/g, '\\\\')
                .replace(/[\"]/g, '\\\"')
                .replace(/[\/]/g, '\\/')
                .replace(/[\b]/g, '\\b')
                .replace(/[\f]/g, '\\f')
                .replace(/[\n]/g, '\\n')
                .replace(/[\r]/g, '\\r')
                .replace(/[\t]/g, '\\t');

            return queryInterface.sequelize.query(
                // tslint:disable-next-line:max-line-length
                `UPDATE "missions" SET "repositories" = $$[{"name": "Repository", "kind": "other", "url": null, "notes": "${repositoryUrl}"}]$$::json WHERE "uid" = :missionUid`,
                {
                    type: QueryTypes.UPDATE,
                    replacements: {
                        missionUid: existingRepositoryEntry.uid
                    }
                });
        });

        await queryInterface.removeColumn('missions', 'repositoryUrl');
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.removeColumn('communities', 'repositories');

        await queryInterface.addColumn('missions', 'repositoryUrl', {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        });

        const existingRepositoryEntries = await queryInterface.sequelize.query(
            'SELECT "uid", "repositories" FROM "missions" WHERE json_array_length("repositories") > 0;',
            { type: QueryTypes.SELECT });

        await Promise.map(existingRepositoryEntries, (existingRepositoryEntry: any) => {
            if (_.isEmpty(existingRepositoryEntry.repositories)) {
                return Promise.resolve();
            }

            const repositoryUrl = _.isNil(existingRepositoryEntry.repositories[0].url) ?
                existingRepositoryEntry.repositories[0].notes :
                existingRepositoryEntry.repositories[0].url;

            return queryInterface.sequelize.query(
                'UPDATE "missions" SET "repositoryUrl" = :repositoryUrl WHERE "uid" = :missionUid',
                {
                    type: QueryTypes.UPDATE,
                    replacements: {
                        missionUid: existingRepositoryEntry.uid,
                        repositoryUrl
                    }
                });
        });

        await queryInterface.removeColumn('missions', 'repositories');
    }
};
