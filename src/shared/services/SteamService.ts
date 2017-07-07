import * as _ from 'lodash';
import { log } from '../util/log';
// tslint:disable-next-line
const openid = require('openid');

import { Steam as SteamConfig } from '../config/Config';

/**
 * Service for retrieving Steam OpenID signing URLs, verifying OpenID claims and retrieving public user information
 *
 * @export
 * @class SteamService
 */
export class SteamService {
    private relyingParty: any;

    constructor() {
        this.relyingParty = new openid.RelyingParty(SteamConfig.openID.callbackURL, SteamConfig.openID.realm, true, true, []);
    }

    public getLoginRedirectURL(): Promise<string> {
        return new Promise<string>((resolve: Function, reject: Function) => {
            log.debug('Retrieving Steam login redirect URL');

            this.relyingParty.authenticate('http://steamcommunity.com/openid', false, (err: any, url: string) => {
                if (!_.isNil(err)) {
                    log.warn({ err }, 'Failed to retrieve Steam login redirect URL');

                    return reject(err);
                }

                log.debug({ url }, 'Successfully retrieved Steam login redirect URL');

                return resolve(url);
            });
        });
    }

    public verifySteamLogin(url: string): Promise<string> {
        return new Promise<string>((resolve: Function, reject: Function) => {
            log.debug({ url }, 'Verifying Steam login');

            this.relyingParty.verifyAssertion(url, (err: any, result: any) => {
                if (!_.isNil(err)) {
                    log.warn({ err }, 'Failed to verify Steam login');

                    return reject(err);
                }

                if (result.authenticated === true) {
                    log.debug({ result }, 'Successfully verified Steam login');

                    return resolve(result.claimedIdentifier);
                } else {
                    log.warn({ result }, 'Failed to verify Steam login');

                    return reject('Failed to verify Steam login');
                }
            });
        });
    }
}

const instance = new SteamService();

export default instance;
