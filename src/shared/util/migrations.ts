import * as _ from 'lodash';
import { Sequelize } from 'sequelize';

/**
 * Provides general util functions for migrations
 */

/**
 * Changes an enum to add or remove enum values
 *
 * @export
 * @param {Sequelize} sequelize Sequelize instance to use for performing queries
 * @param {string} tableName Name of table to change enum for
 * @param {string} columnName Name of column to change enum for
 * @param {string[]} values Complete list of enum values to set
 * @returns {Promise<void>} Promise fulfilled when operation completes
 */
export async function changeEnum(sequelize: Sequelize, tableName: string, columnName: string, values: string[], defaultValue?: string): Promise<void> {
    const enumName = `enum_${tableName}_${columnName}`;
    const oldEnumName = `${enumName}_old`;

    const enumValues = _.map(values, (value: string) => {
        return `'${value}'`;
    }).join(', ');

    const defaultValueString = _.isNull(defaultValue) ? 'NULL' : `'${defaultValue}'::"${enumName}"`;

    const REMOVE_DEFAULT = _.isUndefined(defaultValue) ? null : `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" DROP DEFAULT`;
    const ALTER_OLD = `ALTER TYPE "${enumName}" RENAME TO "${oldEnumName}"`;
    const CREATE_NEW = `CREATE TYPE "${enumName}" AS ENUM(${enumValues})`;
    const ALTER_TABLE = `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" TYPE "${enumName}" USING "${columnName}"::text::"${enumName}"`;
    const SET_DEFAULT = _.isUndefined(defaultValue) ? null : `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DEFAULT ${defaultValueString}`;
    const DROP_OLD = `DROP TYPE "${oldEnumName}"`;

    if (!_.isNil(REMOVE_DEFAULT)) {
        await sequelize.query(REMOVE_DEFAULT);
    }
    await sequelize.query(ALTER_OLD);
    await sequelize.query(CREATE_NEW);
    await sequelize.query(ALTER_TABLE);
    if (!_.isNil(SET_DEFAULT)) {
        await sequelize.query(SET_DEFAULT);
    }
    await sequelize.query(DROP_OLD);
}
