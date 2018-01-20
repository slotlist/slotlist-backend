import * as Boom from 'boom';
import * as Hapi from 'hapi';
import * as HapiAuthJWT from 'hapi-auth-jwt2';
import * as _ from 'lodash';
import * as moment from 'moment';
import * as pjson from 'pjson';

import { HTTP as HTTPConfig, JWT as JWTConfig } from '../shared/config/Config';
import { findPermission, parsePermissions } from '../shared/util/acl';
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
                    cors: true,
                    security: {
                        hsts: { maxAge: 31536000, includeSubdomains: true, preload: true },
                        noOpen: true,
                        noSniff: true,
                        xframe: true,
                        xss: true
                    }
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

    // tslint:disable
    public async start(): Promise<void> {
        log.info({ HTTPConfig, JWTConfig: _.omit(JWTConfig, 'secret') }, 'Starting API server');

        log.debug('Registering inert plugin');
        await this.server.register(require('inert'));

        log.debug('Registering vision plugin');
        await this.server.register(require('vision'));

        log.debug('Registering good plugin');
        await this.server.register({
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
                                        const res: any = _.omit(data, 'config', 'labels', 'responsePayload', 'requestPayload');

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

        this.server.ext('onPostAuth', this.checkACL);
        this.server.ext('onRequest', this.parseRealIP);
        this.server.ext('onPreResponse', this.setAdditionalHeaders);

        log.debug({ routeCount: routes.length }, 'Registering routes');
        this.server.route(routes);

        log.debug('Registering swagger plugin');
        await this.server.register({
            register: require('hapi-swagger'),
            options: {
                info: {
                    title: 'slotlist.info API Documentation',
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
                schemes: [HTTPConfig.publicScheme],
                host: `${HTTPConfig.publicHost}`,
                pathPrefixSize: 2
            }
        });

        log.debug('Starting HTTP server');
        await this.server.start();

        this.startedAt = moment.utc();

        log.info({ startedAt: this.startedAt }, 'Successfully started API server');
    }
    // tslint:enable

    public async stop(): Promise<void> {
        log.info('Stopping API server');
        log.debug('Stopping HTTP server');
        await this.server.stop();

        const stoppedAt = moment.utc();
        const uptime = stoppedAt.diff(this.startedAt);

        log.info({ startedAt: this.startedAt, stoppedAt, uptime }, 'Successfully stopped API server');
    }

    private async validateJWT(decodedJWT: any, request: Hapi.Request, next: Function): Promise<void> {
        log.debug({ function: 'validateJWT', req: request, decodedJWT }, 'Validating JWT');

        const jwtValidationResult = jwtPayloadSchema.validate(decodedJWT);
        if (!_.isNil(jwtValidationResult.error)) {
            log.warn({ function: 'validateJWT', req: request, decodedJWT, err: jwtValidationResult.error }, 'Received invalid JWT payload');

            return next(Boom.forbidden('Invalid JWT payload', { decodedJWT }), false);
        }

        return next(null, true);
    }

    private async checkACL(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Promise<any> {
        if (!_.isNil(request.route) &&
            !_.isNil(request.route.settings) &&
            !_.isNil(request.route.settings.plugins) &&
            !_.isNil((<any>request.route.settings.plugins).acl) &&
            !_.isNil((<any>request.route.settings.plugins).acl.permissions)) {
            const aclConfig = (<any>request.route.settings.plugins).acl;
            const permissions = _.isArray(aclConfig.permissions) ? aclConfig.permissions : [aclConfig.permissions];
            const strict = aclConfig.strict === true;
            const credentials = request.auth.credentials;

            log.debug({ function: 'checkACL', req: request, aclConfig, permissions, strict, credentials }, 'Checking ACL for restricted route');

            if (permissions.length <= 0) {
                log.debug({ function: 'checkACL', permissions, strict, credentials }, 'Required permissions are empty, allowing');

                return reply.continue();
            }

            if (request.auth.isAuthenticated === false) {
                log.debug({ function: 'checkACL', req: request, aclConfig, permissions, strict, credentials }, 'User is not authenticated, rejecting');

                return reply(Boom.unauthorized());
            }

            const parsedPermissions = parsePermissions(request.auth.credentials.permissions);
            if (_.has(parsedPermissions, '*') || findPermission(parsedPermissions, 'admin.superadmin')) {
                log.debug(
                    { function: 'checkACL', permissions, strict, credentials, userUid: credentials.user.uid, hasPermission: true },
                    'User has super admin permissions, allowing');

                return reply.continue();
            }

            // Permissions can include route params, specified in double curley braces (e.g. {{slug}})
            const requiredPermissions = _.map(permissions, (permission: string) => {
                return _.reduce(request.params, (perm: string, value: string, key: string): string => { return perm.replace(`{{${key}}}`, value); }, permission);
            });
            const foundPermissions: string[] = _.filter(requiredPermissions, (requiredPermission: string) => {
                return findPermission(parsedPermissions, requiredPermission);
            });

            const hasPermission = strict ? foundPermissions.length === requiredPermissions.length : foundPermissions.length > 0;

            log.debug(
                { function: 'checkACL', requiredPermissions, strict, credentials, userUid: credentials.user.uid, hasPermission },
                'Successfully finished checking ACL for restricted route');

            if (!hasPermission) {
                log.info(
                    { function: 'checkACL', req: request, requiredPermissions, strict, credentials, userUid: credentials.user.uid, hasPermission },
                    'User tried to access restricted route without proper permission');

                return reply(Boom.forbidden());
            }
        }

        return reply.continue();
    }

    private parseRealIP(request: Hapi.Request, reply: Hapi.ReplyWithContinue): any {
        if (_.isString(request.headers['cf-connecting-ip']) && !_.isEmpty(request.headers['cf-connecting-ip'])) {
            // Retrieve the client's "real" IP from the Cloudflare header if CF is used and the feature has been enabled
            request.info.remoteAddress = request.headers['cf-connecting-ip'];
        } else if (_.isString(request.headers['x-forwarded-for']) && !_.isEmpty(request.headers['x-forwarded-for'])) {
            // Alternatively try to parse the `X-Forwarded-For` header, using the first address provided. If this does not exist either, the client connected directly
            request.info.remoteAddress = request.headers['x-forwarded-for'].split(',')[0].trim();
        }

        // Check for `X-Forwarded-Port` header separately here since `CF-Connecting-IP` does not include the port
        if (_.isString(request.headers['x-forwarded-port']) && !_.isEmpty(request.headers['x-forwarded-port'])) {
            request.info.remotePort = request.headers['x-forwarded-port'];
        }

        return reply.continue();
    }

    private setAdditionalHeaders(request: Hapi.Request, reply: Hapi.ReplyWithContinue): any {
        const response = request.response;
        if (!_.isNil(response) && response.isBoom && !_.isNil(response.output)) {
            response.output.headers['Referrer-Policy'] = 'no-referrer-when-downgrade';
            // tslint:disable-next-line:max-line-length
            response.output.headers['Public-Key-Pins'] = 'pin-sha256="3kcNJzkUJ1RqMXJzFX4Zxux5WfETK+uL6Viq9lJNn4o="; pin-sha256="CfyancXuwYEHYRX3mmLJI3NFW6E8cydaCGS1D9wGhT4="; pin-sha256="58qRu/uxh4gFezqAcERupSkRYBlBAvfcw7mEjGPLnNU="; pin-sha256="grX4Ta9HpZx6tSHkmCrvpApTQGo67CYDnvprLg5yRME="; pin-sha256="YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg="; pin-sha256="sRHdihwgkaib1P1gxX8HFszlD+7/gTfNvuAybgLPNis="; pin-sha256="cZmxAdzqR6QocykhA1KF2BUd4fSAAJBEL9pjp+XA5KY="; pin-sha256="RMmFr2hUG/lUONYDT+SrgzlBlraKipm/DJufF9m/l9U="; pin-sha256="O84tZY/nc8vz0MfbCS8bInyGHhh8jB6WP3reOtSVCm0="; pin-sha256="Ls+kEewW0AVmx+oHvP2VhHkV5mNX4AyBOnbXbY1l32w="; max-age=2592000; includeSubdomains; report-uri="https://morpheusxaut.report-uri.io/r/default/hpkp/enforce";';
        } else if (!_.isNil(response)) {
            response.header('Referrer-Policy', 'no-referrer-when-downgrade');
            // tslint:disable-next-line:max-line-length
            response.header('Public-Key-Pins', 'pin-sha256="3kcNJzkUJ1RqMXJzFX4Zxux5WfETK+uL6Viq9lJNn4o="; pin-sha256="CfyancXuwYEHYRX3mmLJI3NFW6E8cydaCGS1D9wGhT4="; pin-sha256="58qRu/uxh4gFezqAcERupSkRYBlBAvfcw7mEjGPLnNU="; pin-sha256="grX4Ta9HpZx6tSHkmCrvpApTQGo67CYDnvprLg5yRME="; pin-sha256="YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg="; pin-sha256="sRHdihwgkaib1P1gxX8HFszlD+7/gTfNvuAybgLPNis="; pin-sha256="cZmxAdzqR6QocykhA1KF2BUd4fSAAJBEL9pjp+XA5KY="; pin-sha256="RMmFr2hUG/lUONYDT+SrgzlBlraKipm/DJufF9m/l9U="; pin-sha256="O84tZY/nc8vz0MfbCS8bInyGHhh8jB6WP3reOtSVCm0="; pin-sha256="Ls+kEewW0AVmx+oHvP2VhHkV5mNX4AyBOnbXbY1l32w="; max-age=2592000; includeSubdomains; report-uri="https://morpheusxaut.report-uri.io/r/default/hpkp/enforce";');
        }

        reply.continue();
    }
}
