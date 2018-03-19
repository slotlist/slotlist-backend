import * as Boom from 'boom';
import * as _ from 'lodash';
import { Writable } from 'stream';
import * as urlJoin from 'url-join';
import * as uuid from 'uuid';
// tslint:disable-next-line:no-require-imports no-var-requires variable-name
const Storage = require('@google-cloud/storage');

import { Storage as StorageConfig } from '../config/Config';
import { log as logger } from '../util/log';

const log = logger.child({ service: 'ImageService' });

export const MISSION_IMAGE_PATH: string = '/images/uploads/missions';

export const COMMUNITY_LOGO_PATH: string = '/images/uploads/communities';

/**
 * Service for parsing, processing and storing images
 *
 * @export
 * @class ImageService
 */
export class ImageService {
    private storage: any;
    private bucket: any;

    constructor() {
        this.storage = Storage({ projectId: StorageConfig.projectId, keyFilename: StorageConfig.keyFilename });
        this.bucket = this.storage.bucket(StorageConfig.bucketName);
    }

    public async deleteImage(imagePath: string): Promise<void> {
        log.debug({ function: 'deleteImage', imagePath }, 'Deleting image');

        const file = this.bucket.file(imagePath);

        try {
            await file.delete();
        } catch (err) {
            log.warn({ function: 'deleteImage', imagePath, err }, 'Failed to delete image');
            throw Boom.badImplementation('Failed to delete image');
        }

        log.debug({ function: 'deleteImage', imagePath }, 'Successfully deleted image');
    }

    public async deleteAllMissionImages(path: string): Promise<void> {
        let localPath = path;
        if (_.startsWith(localPath, '/')) {
            localPath = localPath.slice(1);
        }
        if (!_.endsWith(localPath, '/')) {
            localPath = `${localPath}/`;
        }

        log.debug({ function: 'deleteAllMissionImages', path: localPath }, 'Deleting all mission images');

        try {
            await this.bucket.deleteFiles({ prefix: localPath, force: true });
        } catch (err) {
            log.warn({ function: 'deleteAllMissionImages', localPath, err }, 'Failed to delete all mission images');
            throw Boom.badImplementation('Failed to delete all mission images');
        }

        log.debug({ function: 'deleteAllMissionImages', path: localPath }, 'Successfully deleted all mission images');
    }

    public getImageUidFromUrl(imageUrl: string): RegExpMatchArray | null {
        const imageUidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;

        return imageUrl.match(imageUidRegex);
    }

    public parseDataUrl(dataUrl: string): RegExpExecArray | null {
        // Taken from https://gist.github.com/bgrins/6194623#gistcomment-1671744 at 2017-09-07
        const dataUrlRegex = /\s*data:([a-z]+\/[a-z0-9\-\+]+(;[a-z\-]+\=[a-z0-9\-]+)?)?(;base64)?,([a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*)\s*/ig;

        return dataUrlRegex.exec(dataUrl);
    }

    public async parseMissionDescription(missionSlug: string, description: string): Promise<string> {
        log.debug({ function: 'parseMissionDescription', missionSlug }, 'Parsing mission description');

        let localDescription = description;
        let imageCount = 0;
        // tslint:disable-next-line:no-constant-condition
        while (true) {
            const matches = this.parseDataUrl(localDescription);
            if (_.isNull(matches)) {
                break;
            }

            const dataUrl = matches[4];
            const imageType = matches[1];
            const imageFolder = urlJoin(MISSION_IMAGE_PATH, missionSlug);
            const imageName = uuid.v4();

            log.debug({ function: 'parseMissionDescription', missionSlug, imageType, imageFolder, imageName }, 'Found image in mission description, processing');
            let imageUrl: string;
            try {
                const imageData = Buffer.from(dataUrl, 'base64');
                imageUrl = await this.uploadImage(imageData, imageName, imageFolder, imageType);
            } catch (err) {
                log.warn(
                    { function: 'parseMissionDescription', missionSlug, imageType, imageFolder, imageName, err },
                    'Failed to process image, replacing data URL with empty string to avoid endless loop');

                localDescription = localDescription.replace(matches[0], '');

                continue;
            }

            log.debug({ function: 'parseMissionDescription', missionSlug, imageType, imageFolder, imageName, imageUrl }, 'Replacing image in mission description');
            localDescription = localDescription.replace(matches[0], imageUrl);
            imageCount += 1;
        }

        log.debug({ function: 'parseMissionDescription', missionSlug, imageCount }, 'Finished parsing mission description');

        return Promise.resolve(localDescription);
    }

    public async uploadImage(imageData: any, imageName: string, imageFolder: string, imageType: string): Promise<string> {
        return new Promise((resolve: (thenableOrResult?: string | PromiseLike<string>) => void, reject: (error?: any) => void) => {
            log.debug({ function: 'uploadImage', imageName, imageFolder, imageType }, 'Preparing image upload');

            const imagePath = urlJoin(imageFolder, imageName);
            const file = this.bucket.file(imagePath);
            const fileStream: Writable = file.createWriteStream({
                metadata: {
                    contentType: imageType,
                    cacheControl: `public, max-age=${StorageConfig.imageCacheControlMaxAge}`
                },
                public: true,
                resumable: false
            });

            fileStream.on('error', (err: any) => {
                log.warn({ function: 'uploadImage', imageType, imagePath, err }, 'Failed to upload image');

                return reject(err);
            });

            fileStream.on('finish', () => {
                const imageUrl = urlJoin(`https://${StorageConfig.bucketName}.storage.googleapis.com`, imagePath);

                log.debug({ function: 'uploadImage', imageType, imagePath, imageUrl }, 'Finished uploading image');

                return resolve(imageUrl);
            });

            log.debug({ function: 'uploadImage', imageType, imagePath }, 'Uploading image');
            fileStream.end(imageData);
        });
    }
}

export const instance = new ImageService();

export default instance;
