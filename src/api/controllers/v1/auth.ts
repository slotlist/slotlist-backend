import * as Hapi from 'hapi';
import { Request } from '../../misc/Request';

/**
 * Handlers for V1 of auth endpoints
 */

export function getSteamLoginRedirectURL(request: Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        return {
            success: true,
            // tslint:disable-next-line:no-http-string
            url: 'http://localhost:3000/v1/auth/steam'
        };
    })());
}

export function verifySteamLogin(request: Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        return {
            success: true,
            token: 'asd'
        };
    })());
}

export const auth = {
    getSteamLoginRedirectURL
};
