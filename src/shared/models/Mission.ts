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
import { IMissionSlotCreatePayload, MissionSlot } from './MissionSlot';
import { MissionSlotGroup } from './MissionSlotGroup';
import { MissionSlotRegistration } from './MissionSlotRegistration';
import { IPublicUser, User } from './User';

/**
 * Missions with `community` visibility are visible to members of the mission creator's community
 */
export const MISSION_VISIBILITY_COMMUNITY = 'community';
/**
 * Missions with `hidden` visibility are only visible to the mission creator and assigned mission editors
 */
export const MISSION_VISIBILITY_HIDDEN = 'hidden';
/**
 * Missions with `private` visibility are only visible to selected users as chosen by the mission creator (not implemented as of 2017-08-23)
 */
export const MISSION_VISIBILITY_PRIVATE = 'private';
/**
 * Missions with `public` visibility are visible to every user
 */
export const MISSION_VISIBILITY_PUBLIC = 'public';
/**
 * List of possible `visibility` settings for a mission, defining which users can view it
 */
export const MISSION_VISIBILITIES = [
    MISSION_VISIBILITY_COMMUNITY,
    MISSION_VISIBILITY_HIDDEN,
    MISSION_VISIBILITY_PRIVATE,
    MISSION_VISIBILITY_PUBLIC
];

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
     *         slotGroups: HasMany
     *     }}
     * @memberof Mission
     */
    public static associations: {
        community: BelongsTo,
        creator: BelongsTo,
        slotGroups: HasMany
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
    public detailedDescription: string;

    /**
     * (Short) summary description of the mission.
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
     * Optional URL of banner iamge to display on mission details.
     * Can be `null` if not defined by mission creator/editor
     *
     * @type {(string | null)}
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
    public bannerImageUrl: string | null;

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
     * Can be `null` if no repository is required
     * Will be added as HTML in frontend, thus allows for regular HTML styling
     *
     * @type {(string | null)}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true
        }
    })
    public repositoryUrl: string | null;

    /**
     * Information about tech support provided before the mission.
     * Can be `null` if no tech support is provided.
     * Will be added as HTML in frontend, thus allows for regular HTML styling
     *
     * @type {(string | null)}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true
        }
    })
    public techSupport: string | null;

    /**
     * Information about special rules set for the mission.
     * Can be `null` if no special rules are defined.
     * Will be added as HTML in frontend, thus allows for regular HTML styling
     *
     * @type {(string | null)}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true
        }
    })
    public rules: string | null;

    /**
     * Indicates the visibility status of the mission.
     * More detailed information about the visibility states can be found in the comments of the respective setting constants.
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.ENUM(MISSION_VISIBILITIES),
        allowNull: false,
        defaultValue: MISSION_VISIBILITY_HIDDEN
    })
    public visibility: string;

    /**
     * UID of the community the mission is associated with.
     * Can be `null` if the creating user has no community assigned
     *
     * @type {(string | null)}
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
    public communityUid: string | null;

    /**
     * Eager-loaded community instance.
     * Only included if the mission is associated with a community and it has been eager-loaded via sequelize
     *
     * @type {(Community | null | undefined)}
     * @memberof Mission
     */
    public community?: Community | null;

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
     * @type {(User | undefined)}
     * @memberof Mission
     */
    public creator?: User;

    /**
     * Eager-loaded list of slot groups associated with the mission.
     * Only included if the mission has slot groups associated and it has been eager-loaded via sequelize
     *
     * @type {(MissionSlotGroup[] | undefined)}
     * @memberof Mission
     */
    public slotGroups?: MissionSlotGroup[];

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
     * Creates a new slot group for the current mission
     *
     * @type {HasManyCreateAssociationMixin<MissionSlotGroup>}
     * @returns {Promise<MissionSlotGroup>} Mission slot group created
     * @memberof Mission
     */
    public createSlotGroup: HasManyCreateAssociationMixin<MissionSlotGroup>;

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
     * Retrieves the mission's slot group instances.
     * Returns an empty array if the mission has no slot groups assigned
     *
     * @type {HasManyGetAssociationsMixin<MissionSlotGroup>}
     * @returns {Promise<MissionSlotGroup[]>} List of mission slot groups
     * @memberof Mission
     */
    public getSlotGroups: HasManyGetAssociationsMixin<MissionSlotGroup>;

    /**
     * Removes the given slot group or a slot group with the provided UID from the missions's slot group list
     *
     * @type {HasManyRemoveAssociationMixin<MissionSlotGroup, string>}
     * @returns {Promise<void>} Promise fulfilled when removal is completed
     * @memberof Mission
     */
    public removeSlotGroup: HasManyRemoveAssociationMixin<MissionSlotGroup, string>;

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
     * Creates a new slot in the mission, automatically associating it with the provided slot group.
     *
     * @param {IMissionSlotCreatePayload} slotPayload Payload including slot details and slot group UID
     * @returns {Promise<MissionSlot>} Newly created mission slot
     * @memberof Mission
     */
    public async createSlot(slotPayload: IMissionSlotCreatePayload): Promise<MissionSlot> {
        const slotGroups = await this.getSlotGroups({ where: { uid: slotPayload.slotGroupUid } });
        if (_.isNil(slotGroups) || _.isEmpty(slotGroups)) {
            throw Boom.notFound('Mission slot group not found');
        }
        const slotGroup = slotGroups[0];

        return slotGroup.createSlot(slotPayload);
    }

    /**
     * Finds a slot by its UID, skipping the requirement to load and iterate all slot groups
     *
     * @param {string} slotUid UID of the slot to search for
     * @returns {(Promise<MissionSlot | null>)} Mission slot instance. Returns null if no slot was found
     * @memberof Mission
     */
    public async findSlot(slotUid: string): Promise<MissionSlot | null> {
        return MissionSlot.findById(slotUid);
    }

    /**
     * Returns the number of slots currently created for the mission
     *
     * @returns {Promise<number>} Number of slots
     * @memberof Mission
     */
    public async getSlotCount(): Promise<number> {
        return await MissionSlot.count({
            include: [
                {
                    model: MissionSlotGroup,
                    as: 'slotGroup',
                    attributes: ['uid'],
                    include: [
                        {
                            model: Mission,
                            as: 'mission',
                            attributes: ['uid'],
                            where: {
                                uid: this.uid
                            }
                        }
                    ],
                    required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                }
            ]
        });
    }

    /**
     * Returns a list of all slots of a mission, optionally filtering for the provided slot group
     *
     * @param {(string | null)} [slotGroupUid=null] Optional slot group UID to filter for, omitting the value or providing `null` retrieves all slots
     * @returns {Promise<MissionSlot[]>} List of mission slots retrieved
     * @memberof Mission
     */
    public async getSlots(slotGroupUid: string | null = null): Promise<MissionSlot[]> {
        const slotGroupQueryOptions: any = {};
        if (!_.isNil(slotGroupUid) && !_.isEmpty(slotGroupUid)) {
            slotGroupQueryOptions.where = { uid: slotGroupUid };
        }
        const slotGroups = await this.getSlotGroups(slotGroupQueryOptions);

        return Promise.reduce(
            slotGroups, async (slots: MissionSlot[], slotGroup: MissionSlotGroup) => {
                return slots.concat(await slotGroup.getSlots());
            },
            []);
    }

    /**
     * Returns the number of slots that have not been assigned yet.
     * Excludes slots with registrations by default
     *
     * @param {boolean} [excludeRegistrations=true] Excludes slots with registrations from unassigned slot count
     * @returns {Promise<number>} Number of unassigned slots
     * @memberof Mission
     */
    public async getUnassignedSlotCount(excludeRegistrations: boolean = true): Promise<number> {
        const slots = await MissionSlot.findAll({
            attributes: ['uid'],
            where: {
                assigneeUid: {
                    $eq: null
                }
            },
            include: [
                {
                    model: MissionSlotGroup,
                    as: 'slotGroup',
                    attributes: ['uid'],
                    include: [
                        {
                            model: Mission,
                            as: 'mission',
                            attributes: ['uid'],
                            where: {
                                uid: this.uid
                            }
                        }
                    ],
                    required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                }
            ]
        });

        if (!excludeRegistrations) {
            return slots.length;
        }

        const slotsWithoutRegistrations = await Promise.filter(slots, async (slot: MissionSlot) => {
            const slotRegistrationCount = await MissionSlotRegistration.count({ where: { slotUid: slot.uid } });

            return slotRegistrationCount === 0;
        });

        return slotsWithoutRegistrations.length;
    }

    /**
     * Checks whether a user is already assigned to any slot of this mission
     *
     * @param {string} userUid UID of user to check assignments for
     * @returns {Promise<boolean>} Promise fulfilled with result of assignment check
     * @memberof Mission
     */
    public async isUserAssignedToAnySlot(userUid: string): Promise<boolean> {
        const assignedSlotCount = await MissionSlot.count({
            where: {
                assigneeUid: userUid
            },
            include: [
                {
                    model: MissionSlotGroup,
                    as: 'slotGroup',
                    attributes: ['uid'],
                    include: [
                        {
                            model: Mission,
                            as: 'mission',
                            attributes: ['uid'],
                            where: {
                                uid: this.uid
                            }
                        }
                    ],
                    required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                }
            ]
        });

        return assignedSlotCount > 0;
    }

    /**
     * Checks whether a user has registered for any slot of this mission
     *
     * @param {string} userUid UID of user to check registrations for
     * @returns {Promise<boolean>} Promise fulfilled with result of registration check
     * @memberof Mission
     */
    public async isUserRegisteredForAnySlot(userUid: string): Promise<boolean> {
        const registeredSlotCount = await MissionSlotRegistration.count({
            where: {
                userUid
            },
            include: [
                {
                    model: MissionSlot,
                    as: 'slot',
                    attributes: ['uid'],
                    include: [
                        {
                            model: MissionSlotGroup,
                            as: 'slotGroup',
                            attributes: ['uid'],
                            include: [
                                {
                                    model: Mission,
                                    as: 'mission',
                                    attributes: ['uid'],
                                    where: {
                                        uid: this.uid
                                    }
                                }
                            ],
                            required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                        }
                    ],
                    required: true // have to force INNER JOIN instead of LEFT INNER JOIN here
                }
            ]
        });

        return registeredSlotCount > 0;
    }

    /**
     * Recalculates and adapts the order numbers of all slots in the mission.
     * Slots are ordered one after another according to the slot group and the old position within the group
     *
     * @returns {Promise<void>} Promise fulfilled when recalculation is finished
     * @memberof Mission
     */
    public async recalculateSlotOrderNumbers(): Promise<void> {
        const slotGroups = _.sortBy(await this.getSlotGroups(), 'orderNumber');

        let slotOrderNumber = 0; // Start at 0 because value gets increased at start of every iteration
        await Promise.each(slotGroups, async (slotGroup: MissionSlotGroup) => {
            const slots = _.sortBy(await slotGroup.getSlots(), 'orderNumber');

            return Promise.each(slots, (slot: MissionSlot) => {
                slotOrderNumber += 1;

                if (slot.orderNumber === slotOrderNumber) {
                    return slot;
                }

                return slot.update({
                    orderNumber: slotOrderNumber
                });
            });
        });
    }

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

        const [publicCreator, totalSlotCount, unassignedSlotCount] = await Promise.all([
            this.creator.toPublicObject(),
            this.getSlotCount(),
            this.getUnassignedSlotCount()
        ]);

        return {
            title: this.title,
            slug: this.slug,
            startTime: this.startTime,
            creator: publicCreator,
            totalSlotCount,
            unassignedSlotCount
        };
    }

    /**
     * Returns a detailed public representation of the mission instance, as transmitted via API
     *
     * @returns {Promise<IDetailedPublicMission>} Object containing detailed public mission information
     * @memberof Mission
     */
    public async toDetailedPublicObject(): Promise<IDetailedPublicMission> {
        if (!_.isNil(this.communityUid)) {
            if (_.isNil(this.community)) {
                this.community = await this.getCommunity();
            }
        }

        if (_.isNil(this.creator)) {
            this.creator = await this.getCreator();
        }

        const [publicCommunity, publicCreator, totalSlotCount, unassignedSlotCount] = await Promise.all([
            !_.isNil(this.communityUid) && !_.isNil(this.community) ? this.community.toPublicObject() : Promise.resolve(null),
            this.creator.toPublicObject(),
            this.getSlotCount(),
            this.getUnassignedSlotCount()
        ]);

        return {
            title: this.title,
            slug: this.slug,
            description: this.description,
            detailedDescription: this.detailedDescription,
            bannerImageUrl: _.isNil(this.bannerImageUrl) ? null : this.bannerImageUrl,
            briefingTime: this.briefingTime,
            slottingTime: this.slottingTime,
            startTime: this.startTime,
            endTime: this.endTime,
            repositoryUrl: _.isNil(this.repositoryUrl) ? null : this.repositoryUrl,
            techSupport: _.isNil(this.techSupport) ? null : this.techSupport,
            rules: _.isNil(this.rules) ? null : this.rules,
            visibility: this.visibility,
            community: publicCommunity,
            creator: publicCreator,
            totalSlotCount,
            unassignedSlotCount
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
    startTime: Date;
    creator: IPublicUser;
    totalSlotCount: number;
    unassignedSlotCount: number;
    isAssignedToAnySlot?: boolean; // only returned for logged in users
    isRegisteredForAnySlot?: boolean; // only returned for logged in users
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
    detailedDescription: string;
    bannerImageUrl: string | null;
    briefingTime: Date;
    slottingTime: Date;
    endTime: Date;
    repositoryUrl: string | null;
    techSupport: string | null;
    rules: string | null;
    visibility: string;
    community: IPublicCommunity | null;
}
