import * as dotenv from 'dotenv';
import * as _ from 'lodash';

if (_.isString(process.env.DOTENV_FILE) && !_.isEmpty(process.env.DOTENV_FILE)) {
    dotenv.config({
        path: process.env.DOTENV_FILE
    });
}

export interface IDatabaseConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
}

export interface IHTTPConfig {
    address: string;
    host: string;
    port: number;
    scheme: 'http' | 'https';
    opsInterval: number;
    publicScheme: 'http' | 'https';
    publicHost: string;
}

export interface IJWTConfig {
    algorithms: string[];
    audience: string;
    expiresIn: string;
    issuer: string;
    secret: string;
}

export interface ILoggingConfig {
    files: {
        path: string;
        level: string | number;
    }[];
    src: boolean;
    stdout: string | number | false;
    stackdriver: boolean;
}

export interface ISteamConfig {
    openID: {
        callbackURL: string;
        realm: string;
    };
    api: {
        secret: string;
    };
}

export interface IStorageConfig {
    bucketName: string;
    projectId: string;
    keyFilename: string;
    imageCacheControlMaxAge: string;
}

/**
 * Configuration class for storing all application-revelant config
 *
 * @export
 * @class Config
 */
export class Config {
    public database: IDatabaseConfig;
    public http: IHTTPConfig;
    public jwt: IJWTConfig;
    public logging: ILoggingConfig;
    public steam: ISteamConfig;
    public storage: IStorageConfig;

    // tslint:disable:cyclomatic-complexity max-func-body-length
    constructor() {
        const configEnvVariables: { [name: string]: string } = {};
        _.each(process.env, (value: string, name: string): void => {
            if (_.startsWith(name, 'CONFIG_')) {
                configEnvVariables[name] = value;
            }
        });

        const databaseConfig: any = {};
        const httpConfig: any = {};
        const jwtConfig: any = {};
        const loggingConfig: any = {};
        const steamConfig: any = {};
        const storageConfig: any = {};

        const loggingConfigFiles: { [key: string]: { path: string; level: string } } = {};

        _.each(configEnvVariables, (value: string, name: string) => {
            const nameParts = name.split('_');
            if (nameParts.length < 3) {
                console.error(`Skipping configEnvVariable '${name}' with value '${value}': invalid naming scheme`);
            }

            const configType = nameParts[1].toLowerCase();
            let configKey = nameParts[2].toLowerCase();

            switch (configType) {
                case 'database':
                    if (configKey === 'port') {
                        try {
                            const intValue = parseInt(value, 10);
                            databaseConfig[configKey] = intValue;
                        } catch (err) {
                            console.error(`Skipping configEnvVariable '${name}' with value '${value}': failed to parse database number`);
                        }

                        break;
                    }

                    databaseConfig[configKey] = value;

                    break;
                case 'http':
                    if (configKey === 'opsinterval') {
                        configKey = 'opsInterval';
                    } else if (configKey === 'publicscheme') {
                        configKey = 'publicScheme';
                    } else if (configKey === 'publichost') {
                        configKey = 'publicHost';
                    }

                    if (configKey === 'port' || configKey === 'opsInterval') {
                        try {
                            const intValue = parseInt(value, 10);

                            httpConfig[configKey] = intValue;
                        } catch (err) {
                            console.error(`Skipping configEnvVariable '${name}' with value '${value}': failed to parse HTTP number`);
                        }

                        break;
                    } else if (configKey === 'scheme') {
                        const scheme = value.toLowerCase();
                        if (scheme !== 'http' && scheme !== 'https') {
                            console.error(`Skipping configEnvVariable '${name}' with value '${value}': invalid HTTP scheme`);
                        } else {
                            httpConfig[configKey] = scheme;
                        }

                        break;
                    }

                    httpConfig[configKey] = value;

                    break;
                case 'jwt':
                    if (configKey === 'expiresin') {
                        configKey = 'expiresIn';
                    }

                    if (configKey === 'algorithms') {
                        jwtConfig.algorithms = value.split(',');

                        break;
                    }

                    jwtConfig[configKey] = value;

                    break;
                case 'logging':
                    if (configKey === 'files') {
                        if (nameParts.length < 5) {
                            console.error(`Skipping configEnvVariable '${name}' with value '${value}': invalid logging files entry`);

                            break;
                        }

                        const fileNumber = nameParts[3];
                        const fileAttribute = nameParts[4].toLowerCase();

                        if (fileAttribute !== 'path' && fileAttribute !== 'level') {
                            console.error(`Skipping configEnvVariable '${name}' with value '${value}': invalid logging files entry`);

                            break;
                        }

                        if (_.isNil(loggingConfigFiles[fileNumber])) {
                            const fileConfig: any = {};
                            loggingConfigFiles[fileNumber] = fileConfig;
                        }

                        loggingConfigFiles[fileNumber][fileAttribute] = value;

                        break;
                    } else if (configKey === 'src') {
                        loggingConfig.src = value.toLowerCase() === 'true';

                        break;
                    } else if (configKey === 'stackdriver') {
                        loggingConfig.stackdriver = value.toLowerCase() === 'true';

                        break;
                    }

                    loggingConfig[configKey] = value;

                    break;
                case 'steam':
                    if (nameParts.length < 4) {
                        console.error(`Skipping configEnvVariable '${name}' with value '${value}': invalid steam subconfig entry`);

                        break;
                    }

                    let subConfigKey = nameParts[3].toLowerCase();

                    if (subConfigKey === 'callbackurl') {
                        subConfigKey = 'callbackURL';
                    }

                    if (configKey === 'openid') {
                        configKey = 'openID';
                    }

                    if (_.isNil(steamConfig[configKey])) {
                        const subConfig: any = {};
                        steamConfig[configKey] = subConfig;
                    }

                    steamConfig[configKey][subConfigKey] = value;

                    break;
                case 'storage':
                    if (configKey === 'bucketname') {
                        configKey = 'bucketName';
                    } else if (configKey === 'projectid') {
                        configKey = 'projectId';
                    } else if (configKey === 'keyfilename') {
                        configKey = 'keyFilename';
                    } else if (configKey === 'imagecachecontrolmaxage') {
                        configKey = 'imageCacheControlMaxAge';
                    }

                    storageConfig[configKey] = value;

                    break;
                default:
                    console.error(`Skipping configEnvVariable '${name}' with value '${value}': unknown type`);
            }
        });

        loggingConfig.files = [];
        _.each(loggingConfigFiles, (f: any) => {
            if (!_.isEmpty(f.path)) {
                loggingConfig.files.push(f);
            }
        });

        this.database = databaseConfig;
        this.http = httpConfig;
        this.jwt = jwtConfig;
        this.logging = loggingConfig;
        this.steam = steamConfig;
        this.storage = storageConfig;
    }
    // tslint:enable:cyclomatic-complexity max-func-body-length
}

export const instance = new Config();
export default instance;

// tslint:disable:variable-name
export const Database = instance.database;
export const HTTP = instance.http;
export const JWT = instance.jwt;
export const Logging = instance.logging;
export const Steam = instance.steam;
export const Storage = instance.storage;
// tslint:enable:variable-name
