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
}

export const instance = new Config();

// tslint:disable:variable-name
export const HTTP = instance.http;
export const JWT = instance.jwt;
export const Logging = instance.logging;
// tslint:enable:variable-name
