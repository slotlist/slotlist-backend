import * as Boom from 'boom';
import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    HasMany,
    HasManyCreateAssociationMixin,
    HasManyGetAssociationsMixin,
    HasManyRemoveAssociationMixin,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import { log as logger } from '../util/log';
import sequelize from '../util/sequelize';
import slug from '../util/slug';
const log = logger.child({ model: 'Community' });

import { Community, IPublicCommunity } from './Community';
import { MissionSlot } from './MissionSlot';
import { IPublicUser, User } from './User';

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
     *         creator: BelongsTo,
     *         slots: HasMany
     *     }}
     * @memberof Mission
     */
    public static associations: {
        community: BelongsTo,
        creator: BelongsTo,
        slots: HasMany
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
        allowNull: false,
        validate: {
            notEmpty: true
        }
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
        unique: true,
        validate: {
            notEmpty: true
        }
    })
    get slug(): string {
        return this.getDataValue('slug');
    }
    set slug(val: string) {
        if (val === 'slugAvailable') {
            throw Boom.badRequest('Disallowed slug');
        }

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
        defaultValue: null,
        validate: {
            notEmpty: true,
            isUrl: true
        }
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
            model: Community,
            key: 'uid'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
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
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
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
     * Eager-loaded list of slots associated with the mission.
     * Only included if the mission has slots associated and it has been eager-loaded via sequelize
     *
     * @type {MissionSlot[]|undefined}
     * @memberof Mission
     */
    public slots?: MissionSlot[];

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
     * Creates a new slot for the current mission
     *
     * @type {HasManyCreateAssociationMixin<MissionSlot>}
     * @returns {Promise<MissionSlot>} Mission slot created
     * @memberof Mission
     */
    public createSlot: HasManyCreateAssociationMixin<MissionSlot>;

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

    /**
     * Retrieves the mission's slot instances.
     * Returns an empty array if the mission has no slots assigned
     *
     * @type {HasManyGetAssociationsMixin<MissionSlot>}
     * @returns {Promise<MissionSlot[]>} List of mission slots
     * @memberof Mission
     */
    public getSlots: HasManyGetAssociationsMixin<MissionSlot>;

    /**
     * Removes the given slot or a slot with the provided UID from the missions's slot list
     *
     * @type {HasManyRemoveAssociationMixin<MissionSlot, string>}
     * @returns {Promise<void>} Promise fulfilled when removal is completed
     * @memberof Mission
     */
    public removeSlot: HasManyRemoveAssociationMixin<MissionSlot, string>;

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
        if (_.isNil(this.creator)) {
            this.creator = await this.getCreator();
        }
        const publicCreator = await this.creator.toPublicObject();

        return {
            title: this.title,
            slug: this.slug,
            shortDescription: this.shortDescription,
            startTime: this.startTime,
            creator: publicCreator
        };
    }

    /**
     * Returns a detailed public representation of the mission instance, as transmitted via API
     *
     * @returns {Promise<IDetailedPublicMission>} Object containing detailed public mission information
     * @memberof Mission
     */
    public async toDetailedPublicObject(): Promise<IDetailedPublicMission> {
        let publicCommunity: IPublicCommunity | null = null;
        if (!_.isNil(this.communityUid)) {
            if (_.isNil(this.community)) {
                this.community = await this.getCommunity();
            }
            publicCommunity = await this.community.toPublicObject();
        }

        if (_.isNil(this.creator)) {
            this.creator = await this.getCreator();
        }
        const publicCreator = await this.creator.toPublicObject();

        return {
            title: this.title,
            slug: this.slug,
            description: this.description,
            shortDescription: this.shortDescription,
            briefingTime: this.briefingTime,
            slottingTime: this.slottingTime,
            startTime: this.startTime,
            endTime: this.endTime,
            repositoryUrl: _.isNil(this.repositoryUrl) ? null : this.repositoryUrl,
            techSupport: _.isNil(this.techSupport) ? null : this.techSupport,
            rules: _.isNil(this.rules) ? null : this.rules,
            community: publicCommunity,
            creator: publicCreator
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
    title: string;
    slug: string;
    shortDescription: string;
    startTime: Date;
    creator: IPublicUser;
}

/**
 * Detailed public mission information as transmitted via API
 *
 * @export
 * @interface IDetailedPublicMission
 * @extends {IPublicMission}
 */
export interface IDetailedPublicMission extends IPublicMission {
    description: string;
    briefingTime: Date;
    slottingTime: Date;
    endTime: Date;
    repositoryUrl: string | null;
    techSupport: string | null;
    rules: string | null;
    community: IPublicCommunity | null;
}
