import * as Hapi from 'hapi';
import { Request } from '../../misc/Request';

import SteamService from '../../../shared/services/SteamService';

/**
 * Handlers for V1 of auth endpoints
 */

export function getSteamLoginRedirectURL(request: Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const url = await SteamService.getLoginRedirectURL();

        return {
            success: true,
            url
        };
    })());
}

export function verifySteamLogin(request: Request, reply: Hapi.ReplyWithContinue): Hapi.Response {
    return reply((async () => {
        const url = request.payload.url;

        const steamID = await SteamService.verifySteamLogin(url);

        return {
            success: true,
            token: steamID
        };
    })());
}

export const auth = {
    getSteamLoginRedirectURL
};
