import axios, * as Axios from 'axios';
import * as Boom from 'boom';
import * as _ from 'lodash';
// tslint:disable-next-line:no-require-imports no-var-requires
const openid = require('openid');

import { Steam as SteamConfig } from '../config/Config';
import { log as logger } from '../util/log';

const log = logger.child({ service: 'SteamService' });

/**
 * Service for retrieving Steam OpenID signing URLs, verifying OpenID claims and retrieving public user information
 *
 * @export
 * @class SteamService
 */
export class SteamService {
    private relyingParty: any;
    private steamAPIClient: Axios.AxiosInstance;

    constructor() {
        this.relyingParty = new openid.RelyingParty(SteamConfig.openID.callbackURL, SteamConfig.openID.realm, true, true, []);
        this.steamAPIClient = axios.create({
            baseURL: 'https://api.steampowered.com',
            params: { key: SteamConfig.api.secret, format: 'json' }
        });
    }

    public async getLoginRedirectURL(): Promise<string> {
        return new Promise<string>((resolve: Function, reject: Function) => {
            log.debug({ function: 'getLoginRedirectURL' }, 'Retrieving Steam login redirect URL');

            this.relyingParty.authenticate('https://steamcommunity.com/openid', false, (err: any, url: string) => {
                if (!_.isNil(err)) {
                    log.warn({ function: 'getLoginRedirectURL', err }, 'Failed to retrieve Steam login redirect URL');

                    return reject(err);
                }

                log.debug({ function: 'getLoginRedirectURL', url }, 'Successfully retrieved Steam login redirect URL');

                return resolve(url);
            });
        });
    }

    public async verifySteamLogin(url: string): Promise<string> {
        return new Promise<string>((resolve: Function, reject: Function) => {
            log.debug({ function: 'verifySteamLogin', url }, 'Verifying Steam login');

            this.relyingParty.verifyAssertion(url, (err: any, result: any) => {
                if (!_.isNil(err)) {
                    log.warn({ function: 'verifySteamLogin', err }, 'Failed to verify Steam login');

                    return reject(err);
                }

                if (result.authenticated === true) {
                    log.debug({ function: 'verifySteamLogin', result }, 'Successfully verified Steam login');

                    const steamIdRegex = /https?\:\/\/steamcommunity\.com\/openid\/id\/(\d+)/;
                    const steamId = steamIdRegex.exec(result.claimedIdentifier);
                    if (_.isNil(steamId) || steamId.length < 2) {
                        log.warn({ function: 'verifySteamLogin', result }, 'Failed to verify Steam login, claimedIdentifier was invalid');

                        return reject(Boom.conflict('Failed to verify Steam login'));
                    }

                    return resolve(steamId[1]);
                } else {
                    log.warn({ function: 'verifySteamLogin', result }, 'Failed to verify Steam login');

                    return reject('Failed to verify Steam login');
                }
            });
        });
    }

    public async getSteamNickname(steamId: string): Promise<string> {
        log.debug({ function: 'getSteamNickname', steamId }, 'Retrieving Steam nickname');

        let response: Axios.AxiosResponse;
        try {
            response = await this.steamAPIClient.get('/ISteamUser/GetPlayerSummaries/v0002/', {
                params: {
                    steamids: steamId
                }
            });
        } catch (err) {
            log.warn({ function: 'getSteamNickname', steamId, err }, 'Failed to retrieve Steam nickname');
            throw Boom.internal('Failed to retrieve Steam nickname', { steamId });
        }

        if (response.status !== 200) {
            log.warn({ function: 'getSteamNickname', steamId, response: _.omit(response, 'request') }, 'Received non-OK reponse status code while retrieving Steam nickname');
            throw Boom.create(response.status, response.statusText, { steamId });
        }

        if (!_.isObject(response.data.response)) {
            log.warn({ function: 'getSteamNickname', steamId, response: _.omit(response, 'request') }, 'Failed to retrieve Steam nickname, response is missing response object');
            throw Boom.internal('Failed to retrieve Steam nickname', { steamId });
        }

        if (!_.isArray(response.data.response.players) || _.isEmpty(response.data.response.players)) {
            log.warn({ function: 'getSteamNickname', steamId, response: _.omit(response, 'request') }, 'Failed to retrieve Steam nickname, response is missing players array');
            throw Boom.internal('Failed to retrieve Steam nickname', { steamId });
        }

        if (!_.isString(response.data.response.players[0].personaname) || _.isEmpty(response.data.response.players[0].personaname)) {
            log.warn({ function: 'getSteamNickname', steamId, response: _.omit(response, 'request') }, 'Failed to retrieve Steam nickname, response is missing personaname');
            throw Boom.internal('Failed to retrieve Steam nickname', { steamId });
        }

        log.debug({ function: 'getSteamNickname', steamId, nickname: response.data.response.players[0].personaname }, 'Successfully retrieved Steam nickname');

        return response.data.response.players[0].personaname;
    }
}

const instance = new SteamService();

export default instance;
