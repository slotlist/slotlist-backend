import * as Joi from 'joi';

import * as jwt from 'jsonwebtoken';
import * as moment from 'moment';
import { JWT as JWTConfig } from '../../../shared/config/Config';
import { log } from '../../../shared/util/log';

import * as controller from '../../controllers/v1/auth';

/**
 * All routes regarding authentication
 */
export const auth = [
    {
        method: 'GET',
        path: '/v1/auth/steam',
        handler: controller.getSteamLoginRedirectURL,
        config: {
            auth: false,
            description: 'Returns the redirect URL for Steam OpenID signin',
            notes: 'SSO callback returns to frontend, backend later verifies claims via POST to `/v1/auth/steam`',
            tags: ['api', 'get', 'v1', 'auth', 'steam'],
            response: {
                schema: Joi.object().required().keys({
                    url: Joi.string().required().uri().description('Steam OpenID URL to redirect to for signin')
                }).label('GetSteamLoginRedirectURLResponse').description('Response containing Steam OpenID URL to redirect user to')
            }
        }
    },
    {
        method: 'post',
        path: '/v1/auth/steam',
        handler: controller.verifySteamLogin,
        config: {
            auth: false,
            description: 'Verifies the provided Steam OpenID claims and returns a JWT on success',
            notes: 'After the verification call to Steam\'s OpenID provider succeedes, the current user database will be checked for the ' +
            'SteamID. If the user does not exist, their public Steam information will be retrieved and a new entry created. A JWT with ' +
            'the user\'s nickname as well as permissions is then returned',
            tags: ['api', 'post', 'v1', 'auth', 'steam', 'verify', 'jwt'],
            validate: {
                options: {
                    abortEarly: false
                },
                payload: Joi.object().required().keys({
                    url: Joi.string().required().uri().description('Steam OpenID claims in URL form, as returned to the frontend')
                }).label('VerifySteamLogin')
            },
            response: {
                schema: Joi.object().required().keys({
                    token: Joi.string().required().min(1).description('JWT to use for authentication')
                }).label('VerifySteamLoginResponse').description('Response containing JWT to use for authentication')
            }
        }
    },
    {
        method: 'get',
        path: '/v1/auth/test',
        handler: (request: any, reply: any) => {
            log.debug({ req: request }, 'is this authed?');
            reply({ text: 'You used a Token!' })
                .header('Authorization', request.headers.authorization);
        },
        config: {
            auth: 'jwt'
        }
    },
    {
        method: 'get',
        path: '/v1/auth/token',
        handler: (request: any, reply: any) => {
            const payload = {
                nickname: 'MorpheusXAUT'
            };

            const jwtSignOptions: jwt.SignOptions = {
                algorithm: JWTConfig.algorithms[0],
                audience: JWTConfig.audience,
                expiresIn: JWTConfig.expiresIn,
                issuer: JWTConfig.issuer,
                subject: '22d16b55-666d-4d24-9a53-2b4c71b96a85',
                notBefore: moment.utc().seconds().toString()
            };

            log.debug({ jwtSignOptions }, 'Generating JWT for user');

            const token = jwt.sign(payload, JWTConfig.secret, jwtSignOptions);

            reply({ token });
        },
        config: {
            auth: false
        }
    }
];
