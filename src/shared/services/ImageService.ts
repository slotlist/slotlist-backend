import * as _ from 'lodash';
import { Writable } from 'stream';
import * as urlJoin from 'url-join';
import * as uuid from 'uuid';
// tslint:disable-next-line:no-require-imports no-var-requires variable-name
const Storage = require('@google-cloud/storage');

import { Storage as StorageConfig } from '../config/Config';
import { log as logger } from '../util/log';

const log = logger.child({ service: 'ImageService' });

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

    public async parseMissionDescription(missionSlug: string, description: string): Promise<string> {
        log.debug({ function: 'parseMissionDescription', missionSlug }, 'Parsing mission description');

        let imageCount = 0;
        // tslint:disable-next-line:no-constant-condition
        while (true) {
            // Taken from https://gist.github.com/bgrins/6194623#gistcomment-1671744 at 2017-09-07
            const dataUrlRegex = /\s*data:([a-z]+\/[a-z0-9\-\+]+(;[a-z\-]+\=[a-z0-9\-]+)?)?(;base64)?,([a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*)\s*/ig;
            const matches = dataUrlRegex.exec(description);
            if (_.isNull(matches)) {
                break;
            }

            const dataUrl = matches[4];
            const imageType = matches[1];
            const imagePath = urlJoin('/images/uploads/missions', missionSlug);
            const imageName = uuid.v4();

            log.debug({ function: 'parseMissionDescription', missionSlug, imageType, imagePath, imageName }, 'Found image in mission description, processing');
            let imageUrl: string;
            try {
                imageUrl = await this.processImage(dataUrl, imageName, imagePath, imageType);
            } catch (err) {
                log.warn(
                    { function: 'parseMissionDescription', missionSlug, imageType, imagePath, imageName, err },
                    'Failed to process image, replacing data URL with empty string to avoid endless loop');

                description = description.replace(matches[0], '');

                continue;
            }

            log.debug({ function: 'parseMissionDescription', missionSlug, imageType, imagePath, imageName, imageUrl }, 'Replacing image in mission description');
            description = description.replace(matches[0], imageUrl);
            imageCount += 1;
        }

        log.debug({ function: 'parseMissionDescription', missionSlug, imageCount }, 'Finished parsing mission description');

        return Promise.resolve(description);
    }

    public async processImage(dataUrl: string, imageName: string, imageFolder: string, imageType: string): Promise<string> {
        return new Promise((resolve: (thenableOrResult?: string | PromiseLike<string>) => void, reject: (error?: any) => void) => {
            log.debug({ function: 'processImage', imageName, imageFolder, imageType }, 'Processing image');

            const imageData = Buffer.from(dataUrl, 'base64');
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
                log.warn({ function: 'processImage', imageType, imagePath, err }, 'Failed to upload image');

                return reject(err);
            });

            fileStream.on('finish', () => {
                log.debug({ function: 'processImage', imageType, imagePath }, 'Finished uploading image');

                const imageUrl = urlJoin('https://storage.googleapis.com', StorageConfig.bucketName, imagePath);

                log.debug({ function: 'processImage', imageType, imagePath, imageUrl }, 'Finished processing image');

                return resolve(imageUrl);
            });

            log.debug({ function: 'processImage', imageType, imagePath }, 'Uploading image');
            fileStream.end(imageData);
        });
    }
}

const instance = new ImageService();

export default instance;
