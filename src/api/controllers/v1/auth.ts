import * as Hapi from 'hapi';

import SteamService from '../../../shared/services/SteamService';

/**
 * Handlers for V1 of auth endpoints
 */

export function getSteamLoginRedirectURL(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const url = await SteamService.getLoginRedirectURL();

        return {
            url
        };
    })());
}

export function verifySteamLogin(request: Hapi.Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const url = request.payload.url;

        const steamID = await SteamService.verifySteamLogin(url);

        return {
            token: steamID
        };
    })());
}

export const auth = {
    getSteamLoginRedirectURL
};
