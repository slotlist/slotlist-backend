import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as HapiAuthJWT from 'hapi-auth-jwt2';
import * as _ from 'lodash';
import * as moment from 'moment';
import * as pjson from 'pjson';

import { HTTP as HTTPConfig, JWT as JWTConfig } from '../shared/config/Config';
import Storage from '../shared/services/Storage';
import log from '../shared/util/log';

import { jwtPayloadSchema } from '../shared/schemas/auth';

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
            },
            debug: false
        });

        this.server.connection({
            address: HTTPConfig.address,
            port: HTTPConfig.port,
            host: HTTPConfig.host
        });
    }

    // tslint:disable-next-line:max-func-body-length
    public async start(): Promise<void> {
        log.info({ HTTPConfig, JWTConfig: _.omit(JWTConfig, 'secret') }, 'Starting API server');

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
                            { ops: '*', response: '*', log: '*', error: '*', request: '*' },
                            {
                                logger: log.child({ hapi: true }),
                                levels: {
                                    error: 'error',
                                    log: 'info',
                                    ops: 'info',
                                    request: 'debug',
                                    response: 'debug'
                                },
                                formatters: {
                                    error: (data: any): any => {
                                        const res: any = _.omit(data, 'config', 'labels');
                                        res.err = res.error;

                                        return [res, `ERROR --> ${data.url.path}`];
                                    },
                                    response: (data: any): any => {
                                        const res: any = _.omit(data, 'config', 'labels');

                                        return [res, `--> ${data.path}`];
                                    }
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
                host: `${HTTPConfig.host}:${HTTPConfig.port}`,
                pathPrefixSize: 2
            }
        });

        log.debug('Starting HTTP server');
        await this.server.start();

        this.startedAt = moment.utc();

        log.info({ startedAt: this.startedAt }, 'Successfully started API server');

        // TODO remove after umzug migrations have been added
        await Storage.sequelize.sync({ force: true });
    }

    public async stop(): Promise<void> {
        log.info('Stopping API server');
        log.debug('Stopping HTTP server');
        await this.server.stop();

        const stoppedAt = moment.utc();
        const uptime = stoppedAt.diff(this.startedAt);

        log.info({ startedAt: this.startedAt, stoppedAt, uptime }, 'Successfully stopped API server');
    }

    private async validateJWT(decodedJWT: any, request: Hapi.Request, next: Function): Promise<void> {
        log.debug({ req: request, decodedJWT }, 'Validating JWT');

        const jwtValidationResult = jwtPayloadSchema.validate(decodedJWT);
        if (!_.isNil(jwtValidationResult.error)) {
            log.warn({ req: request, decodedJWT, err: jwtValidationResult.error }, 'Received invalid JWT payload');

            return next(Boom.forbidden('Invalid JWT payload', { decodedJWT }), false);
        }

        return next(null, true);
    }
}
