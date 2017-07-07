import * as Hapi from 'hapi';
import * as HapiAuthJWT from 'hapi-auth-jwt2';
import * as _ from 'lodash';
import * as moment from 'moment';

import * as pjson from 'pjson';
import { HTTP as HTTPConfig, JWT as JWTConfig } from '../shared/config/Config';
import log from '../shared/util/log';
import { routes } from './routes/routes';

/**
 * API class for handling all web requests
 *
 * @export
 * @class API
 */
export class API {
    private server: Hapi.Server;
    private startedAt: moment.Moment;

    constructor() {
        this.server = new Hapi.Server({
            connections: {
                routes: {
                    cors: true
                }
            }
        });

        this.server.connection({
            address: HTTPConfig.address,
            port: HTTPConfig.port,
            host: HTTPConfig.host
        });
    }

    public async start(): Promise<void> {
        log.info({ HTTPConfig, JWTConfig: _.omit(JWTConfig, 'secret') }, 'Starting API server');

        const hapiChildLogger = log.child({ hapi: true });
        log.debug('Registering bunyan logging plugging');
        await this.server.register({
            // tslint:disable-next-line:no-require-imports
            register: require('hapi-bunyan'),
            options: {
                logger: hapiChildLogger
            }
        });

        log.debug('Registering inert plugin');
        // tslint:disable-next-line:no-require-imports
        await this.server.register(require('inert'));

        log.debug('Registering vision plugin');
        // tslint:disable-next-line:no-require-imports
        await this.server.register(require('vision'));

        log.debug('Registering good plugin');
        await this.server.register({
            // tslint:disable-next-line:no-require-imports
            register: require('good'),
            options: {
                ops: {
                    interval: HTTPConfig.opsInterval
                },
                includes: {
                    request: ['headers', 'payload'],
                    response: ['payload']
                },
                reporters: {
                    bunyan: [{
                        module: 'good-bunyan',
                        args: [
                            { ops: '*', response: '*', log: '*', errror: '*', request: '*', 'request-internal': '*' },
                            {
                                logger: hapiChildLogger,
                                levels: {
                                    ops: 'debug'
                                }
                            }
                        ]
                    }]
                }
            }
        });

        log.debug('Registering JWT auth plugin');
        await this.server.register(HapiAuthJWT);

        this.server.auth.strategy('jwt', 'jwt', {
            cookieKey: false,
            headerKey: 'authorization',
            key: JWTConfig.secret,
            tokenType: 'JWT',
            urlKey: false,
            validateFunc: this.validateJWT,
            verifyOptions: {
                algorithms: JWTConfig.algorithms,
                audience: JWTConfig.audience,
                issuer: JWTConfig.issuer,
                ignoreExpiration: false
            }
        });

        this.server.auth.default('jwt');

        log.debug({ routeCount: routes.length }, 'Registering routes');
        this.server.route(routes);

        log.debug('Registering swagger plugin');
        await this.server.register({
            // tslint:disable-next-line:no-require-imports
            register: require('hapi-swagger'),
            options: {
                info: {
                    title: `${pjson.name} API Documentation`,
                    version: pjson.version,
                    contact: {
                        name: 'Nick \'MorpheusXAUT\' Mueller',
                        email: 'nick@slotlist.info'
                    },
                    termsOfService: 'https://slotlist.info/#/about',
                    license: {
                        name: 'MIT',
                        url: 'https://github.com/MorpheusXAUT/slotlist-backend/blob/master/LICENSE'
                    }
                },
                schemes: [HTTPConfig.scheme],
                host: `${HTTPConfig.host}:${HTTPConfig.port}`
            }
        });

        log.debug('Starting HTTP server');
        await this.server.start();

        this.startedAt = moment.utc();

        log.info({ startedAt: this.startedAt }, 'Successfully started API server');
    }

    public async stop(): Promise<void> {
        log.info('Stopping API server');
        log.debug('Stopping HTTP server');
        await this.server.stop();

        const stoppedAt = moment.utc();
        const uptime = stoppedAt.diff(this.startedAt);

        log.info({ startedAt: this.startedAt, stoppedAt, uptime }, 'Successfully stopped API server');
    }

    private validateJWT(decoded: object, request: Hapi.Request, next: Function): void {
        log.debug({ req: request, decoded }, 'Validating JWT');

        return next(null, true);
    }
}
