import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import { log as logger } from '../util/log';
import sequelize from '../util/sequelize';
import slug from '../util/slug';
const log = logger.child({ model: 'Community' });

import { Community } from './Community';
import { User } from './User';

/**
 * Represents a mission in database.
 * Provides database access and utility functionality for mission instances
 *
 * @export
 * @class Mission
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'missions',
    paranoid: false
})
export class Mission extends Model {
    /**
     * Associations of the mission model
     *
     * @static
     * @type {{
     *         community: BelongsTo,
     *         creator: BelongsTo
     *     }}
     * @memberof Mission
     */
    public static associations: {
        community: BelongsTo,
        creator: BelongsTo
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the mission in the database
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Title of the mission
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false
    })
    public title: string;

    /**
     * Slug used for identifying a mission in the frontend.
     * More user-friendly version of a UID, makes for prettier URLs
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    })
    get slug(): string {
        return this.getDataValue('slug');
    }
    set slug(val: string) {
        this.setDataValue('slug', slug(val));
    }

    /**
     * (Detailed) description of the mission.
     * Will be added as HTML in frontend, thus allows for regular HTML styling
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public description: string;

    /**
     * (Short) summary description of the mission.
     * Will be added as HTML in frontend, thus allows for regular HTML styling
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public shortDescription: string;

    /**
     * Time (and date) the mission briefing starts.
     * The mission briefing is mainly intended for players in leadership roles
     *
     * @type {Date}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false
    })
    public briefingTime: Date;

    /**
     * Time (and date) the slotting starts.
     * Slotting usually starts a little bit before the actual mission start to allow for faster transition
     *
     * @type {Date}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false
    })
    public slottingTime: Date;

    /**
     * Time (and date) the mission starts.
     * Must be after or equal to slotting time
     *
     * @type {Date}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
            afterSlottingTime(val: Date): void {
                if (val < this.slottingTime) {
                    throw new Error('Mission startTime must be after slottingTime');
                }
            }
        }
    })
    public startTime: Date;

    /**
     * Time (and date) the mission is scheduled to end.
     * This time is only an estimate by the mission creator, actual time might differ.
     * Must be after or equal to start time
     *
     * @type {Date}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
            afterStartTime(val: Date): void {
                if (val < this.startTime) {
                    throw new Error('Mission endTime must be after startTime');
                }
            }
        }
    })
    public endTime: Date;

    /**
     * URL of the repository used for the mission.
     * Can be `undefined|null` if no repository is required
     *
     * @type {string|undefined|null}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    })
    public repositoryUrl?: string;

    /**
     * Information about tech support provided before the mission.
     * Can be `undefined|null` if no tech support is provided.
     * Will be added as HTML in frontend, thus allows for regular HTML styling
     *
     * @type {string|undefined|null}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    })
    public techSupport?: string;

    /**
     * Information about special rules set for the mission.
     * Can be `undefined|null` if no special rules are defined.
     * Will be added as HTML in frontend, thus allows for regular HTML styling
     *
     * @type {string|undefined|null}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    })
    public rules?: string;

    /**
     * UID of the community the mission is associated with.
     * Can be `undefined|null` if the creating user has no community assigned
     *
     * @type {string|undefined|null}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
            model: 'communities',
            key: 'uid'
        },
        onDelete: 'SET NULL'
    })
    public communityUid?: string;

    /**
     * Eager-loaded community instance.
     * Only included if the mission is associated with a community and it has been eager-loaded via sequelize
     *
     * @type {Community|undefined}
     * @memberof Mission
     */
    public community?: Community;

    /**
     * UID of the user that created the mission
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: User,
            key: 'uid'
        }
    })
    public creatorUid: string;

    /**
     * Eager-loaded creator user instance.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {User|undefined}
     * @memberof Mission
     */
    public creator?: User;

    /**
     * Time (and date) the mission instance was created
     *
     * @type {Date}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the mission instance was last updated
     *
     * @type {Date}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public updatedAt: Date;

    ////////////////////////////
    // Sequelize model mixins //
    ////////////////////////////

    /**
     * Retrieves the mission's community instance.
     * Only returns a result if the mission has been associated with a community
     *
     * @type {BelongsToGetAssociationMixin<Community>}
     * @returns {Promise<Community>} Community instance
     * @memberof Mission
     */
    public getCommunity: BelongsToGetAssociationMixin<Community>;

    /**
     * Retrieves the mission's creator user instance
     *
     * @type {BelongsToGetAssociationMixin<User>}
     * @returns {Promise<User>} User instance
     * @memberof Mission
     */
    public getCreator: BelongsToGetAssociationMixin<User>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    /**
     * Checks whether the given slug is available for new missions
     *
     * @static
     * @param {string} newSlug Slug (can be unescaped) to check for
     * @returns {Promise<boolean>} Indicates whether the slug is available
     * @memberof Mission
     */
    // tslint:disable-next-line:function-name
    public static async isSlugAvailable(newSlug: string): Promise<boolean> {
        log.debug({ function: 'isSlugAvailable', newSlug }, 'Checking if mission slug is available');

        const mission = await this.findOne({
            where: { slug: slug(newSlug) },
            attributes: ['uid']
        });

        const isSlugAvailable = _.isNil(mission);

        log.debug({ function: 'isSlugAvailable', newSlug, isSlugAvailable }, 'Successfully finished checking if mission slug is available');

        return isSlugAvailable;
    }

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the mission instance, as transmitted via API
     *
     * @returns {Promise<IPublicMission>} Object containing public mission information
     * @memberof Mission
     */
    public async toPublicObject(): Promise<IPublicMission> {
        return {
            uid: this.uid
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public mission information as transmitted via API
 *
 * @export
 * @interface IPublicMission
 */
export interface IPublicMission {
    uid: string;
}
