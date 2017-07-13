import * as _ from 'lodash';
import * as path from 'path';
import * as pg from 'pg';
import * as Sequelize from 'sequelize';
import * as Umzug from 'umzug';

import { Database as DatabaseConfig } from '../config/Config';
import { log } from '../util/log';

import User, * as _User from '../models/User';

export interface IDefaultModelAttributes {
    createdAt: Date;
    updatedAt: Date;
}

export interface IDefaultParanoidModelAttributes extends IDefaultModelAttributes {
    deletedAt: Date;
}

export interface IModels {
    User: _User.IUserModel;
}

const MODEL_FACTORY_FUNCTIONS: { [key: string]: Function } = {
    User
};

pg.defaults.parseInt8 = true;

/**
 * Service for accessing database storage
 *
 * @export
 * @class Storage
 */
export class Storage {
    // tslint:disable:variable-name
    private _models: IModels | undefined;
    private _sequelize: Sequelize.Sequelize | undefined;
    private _umzug: Umzug.Umzug | undefined;
    // tslint:enable:variable-name

    constructor() {
        this.initialize();
    }

    get models(): IModels {
        if (_.isNil(this._sequelize)) {
            log.fatal('Tried to get models from disconnected storage');
            throw new Error('Cannot get models, storage is disconnected');
        }

        return <IModels>this._models;
    }

    get sequelize(): Sequelize.Sequelize {
        if (_.isNil(this._sequelize)) {
            log.fatal('Tried to get sequelize instance from disconnected storage');
            throw new Error('Cannot get sequelize instance, storage is disconnected');
        }

        return <Sequelize.Sequelize>this._sequelize;
    }

    public static PROCESS_MODELS(sequelize: Sequelize.Sequelize, modelFactoryFunctions: { [key: string]: Function }): IModels {
        // tslint:disable-next-line:max-line-length
        const models: any = _.mapValues(modelFactoryFunctions, (sequelizeModelFunction: Function, modelName: string): Sequelize.Model<{}, {}> => {
            return sequelizeModelFunction(sequelize);
        });

        const modelsWithAssociation = _.filter(_.values(models), (model: any) => {
            return _.isFunction(model.associate);
        });
        _.each(modelsWithAssociation, (model: any) => {
            model.associate(models);
        });

        return models;
    }

    public transaction(autoCallback: (t: Sequelize.Transaction) => Promise<any>): Promise<any> {
        // tslint:disable
        const namespace = Sequelize.cls;
        const transactionFromContext = namespace.get('transaction');

        if (transactionFromContext) {
            return autoCallback(transactionFromContext);
        }

        return this.sequelize.transaction(autoCallback);
        // tslint:enable
    }

    public reinitialize(
        options: any = { newSequelize: true, newUmzug: true, newModels: true },
        customSequelize?: Sequelize.Sequelize, customModels?: IModels): void {
        log.info(
            { options, customSequelizeProvided: !_.isNil(customSequelize), customModelsProvided: !_.isNil(customModels) },
            'Reinitializing storage');

        if (options.newSequelize) {
            this.initializeSequelize(customSequelize);
        }

        if (options.newUmzug) {
            this.initializeUmzug();
        }

        if (options.newModels) {
            this.initializeModels(customModels);
        }

        log.info(
            { options, customSequelizeProvided: !_.isNil(customSequelize), customModelsProvided: !_.isNil(customModels) },
            'Finished reinitializing storage');
    }

    public disconnect(): void {
        log.info('Disconnecting storage');

        if (!_.isNil(this._sequelize)) {
            this._sequelize.close();
        }

        this._sequelize = undefined;
        this._umzug = undefined;
        this._models = undefined;
    }

    private initialize(): void {
        log.info('Initialising storage');

        this.initializeSequelize();
        this.initializeUmzug();
        this.initializeModels();
    }

    private initializeSequelize(customSequelize?: Sequelize.Sequelize): void {
        log.debug({ customSequelizeProvided: !_.isNil(customSequelize) }, 'Initializing sequelize');

        if (_.isNil(customSequelize)) {
            this._sequelize = new Sequelize(DatabaseConfig.database, DatabaseConfig.username, DatabaseConfig.password, {
                benchmark: true,
                dialect: 'postgres',
                host: DatabaseConfig.host,
                logging: (query: any, executionTime: any) => {
                    log.trace({ sequelize: true, query, executionTime }, 'sequelize query');
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
        } else {
            this._sequelize = customSequelize;
        }

        log.debug({ customSequelizeProvided: !_.isNil(customSequelize) }, 'Finished initializing sequelize');
    }

    private initializeUmzug(): void {
        log.debug('Initializing umzug');

        this._umzug = new Umzug({
            logging: (message: any) => {
                log.info({ umzug: true }, message);
            },
            migrations: {
                params: [
                    this.sequelize.getQueryInterface()
                ],
                path: path.resolve(__dirname, '../migrations'),
                pattern: /^\d+[\w-]+\.js$/
            },
            storage: 'sequelize',
            storageOptions: {
                sequelize: this._sequelize
            }
        });

        log.debug('Finished initializing umzug');
    }

    private initializeModels(customModels?: IModels): void {
        log.debug({ customModelsProvided: !_.isNil(customModels) }, 'Initializing models');

        if (_.isNil(customModels)) {
            this._models = Storage.PROCESS_MODELS(this.sequelize, MODEL_FACTORY_FUNCTIONS);
        } else {
            this._models = customModels;
        }

        log.debug({ customModelsProvided: !_.isNil(customModels) }, 'Finished initializing models');
    }
}

const instance: Storage = new Storage();
export default instance;

// tslint:disable:variable-name
export const Users = instance.models.User;
// tslint:enable:variable-name
