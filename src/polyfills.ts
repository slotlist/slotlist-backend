import * as bluebird from 'bluebird';
import * as cls from 'continuation-local-storage';
import * as Sequelize from 'sequelize';
import * as sourceMapSupport from 'source-map-support';
import * as uuid from 'uuid';

/**
 * Installs global polyfills and utils
 */

sourceMapSupport.install();

const processCLSNamespace = cls.createNamespace(`SL_${uuid.v4()}`);
// tslint:disable-next-line:no-unsafe-any
(<any>Sequelize).useCLS(processCLSNamespace);

// tslint:disable-next-line
const patchBluebird = require('cls-bluebird');
patchBluebird(processCLSNamespace);

global.Promise = bluebird;

// tslint:disable-next-line:no-console
console.log(`Polyfills installed. CLS=${processCLSNamespace.name}`);
