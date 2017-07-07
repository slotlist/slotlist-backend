export interface IHTTPConfig {
    address: string;
    host: string;
    port: number;
    scheme: 'http' | 'https';
    opsInterval: number;
}

export interface IJWTConfig {
    algorithms: string[];
    audience: string;
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

/**
 * Configuration class for storing all application-revelant config
 *
 * @export
 * @class Config
 */
export class Config {
    public http: IHTTPConfig = {
        address: '0.0.0.0',
        host: 'localhost',
        port: 3000,
        scheme: 'http',
        opsInterval: 900000
    };

    public jwt: IJWTConfig = {
        algorithms: ['HS256'],
        audience: 'https://api.slotlist.info',
        issuer: 'https://api.slotlist.info',
        secret: 'supersecret'
    };

    public logging: ILoggingConfig = {
        files: [
            {
                path: 'logs/slotlist-backend.log',
                level: 'debug'
            }
        ],
        src: true,
        stdout: 'debug'
    };

    public steam: ISteamConfig = {
        openID: {
            callbackURL: 'http://localhost:4000/#/login',
            realm: 'http://localhost:4000'
        },
        api: {
            secret: 'supersecret'
        }
    };
}

export const instance = new Config();

// tslint:disable:variable-name
export const HTTP = instance.http;
export const JWT = instance.jwt;
export const Logging = instance.logging;
export const Steam = instance.steam;
// tslint:enable:variable-name
