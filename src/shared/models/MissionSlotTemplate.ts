import * as Boom from 'boom';
import * as Joi from 'joi';
import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';

import { missionSlotTemplateSlotGroupSchema } from '../schemas/missionSlotTemplate';
import { MISSION_VISIBILITIES, MISSION_VISIBILITY_HIDDEN } from './Mission';
import { IPublicUser, User } from './User';

const missionSlotTemplateSlotGroupsSchema = Joi.array().items(missionSlotTemplateSlotGroupSchema.optional()).required();

/**
 * Represents a mission slot template in database.
 * Provides database access and utility functionality for mission slot template instances
 *
 * @export
 * @class MissionSlotTemplate
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'missionSlotTemplates',
    paranoid: false
})
export class MissionSlotTemplate extends Model {
    /**
     * Associations of the mission slot template model
     *
     * @static
     * @type {{
     *         creator: BelongsTo
     *     }}
     * @memberof MissionSlotTemplate
     */
    public static associations: {
        creator: BelongsTo;
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the mission slot template in the database
     *
     * @type {string}
     * @memberof MissionSlotTemplate
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Title of the mission slot template
     *
     * @type {string}
     * @memberof MissionSlotTemplate
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public title: string;

    @Attribute({
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        validate: {
            validSlotGroupsAndSlots(val: any): void {
                const slots = _.isArray(val) ? val : [val];

                const validationResult = Joi.validate(slots, missionSlotTemplateSlotGroupsSchema);
                if (!_.isNil(validationResult.error)) {
                    throw Boom.badRequest('Invalid mission slot template data', validationResult);
                }
            }
        }
    })
    public slotGroups: IMissionSlotTemplateSlotGroup[];

    /**
     * Indicates the visibility status of the slot template.
     * This reuses the mission visibility settings, more information about the statuses can be found in their respective comments.
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
     * UID of the user that has created the slot template.
     *
     * @type {(string)}
     * @memberof MissionSlotTemplate
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
     * Eager-loaded user instance.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(User | undefined)}
     * @memberof MissionSlotTemplate
     */
    public creator?: User;

    /**
     * Time (and date) the mission slot template instance was created
     *
     * @type {Date}
     * @memberof MissionSlotTemplate
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the mission slot template instance was last updated
     *
     * @type {Date}
     * @memberof MissionSlotTemplate
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
     * Retrieves the slot template's creator user instance.
     *
     * @type {BelongsToGetAssociationMixin<User>}
     * @returns {Promise<User>} User instance
     * @memberof MissionSlotTemplate
     */
    public getCreator: BelongsToGetAssociationMixin<User>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the mission slot template instance, as transmitted via API
     *
     * @returns {Promise<IPublicMissionSlotTemplate>} Object containing public mission slot template information
     * @memberof MissionSlotTemplate
     */
    public async toPublicObject(): Promise<IPublicMissionSlotTemplate> {
        if (_.isNil(this.creator)) {
            this.creator = await this.getCreator();
        }
        const publicCreator = await this.creator.toPublicObject();

        const slotGroupCount = this.slotGroups.length;
        const slotCount = _.reduce(
            this.slotGroups, (total: number, slotGroup: IMissionSlotTemplateSlotGroup) => {
                return total + slotGroup.slots.length;
            },
            0);

        return {
            uid: this.uid,
            title: this.title,
            slotGroupCount,
            slotCount,
            visibility: this.visibility,
            creator: publicCreator
        };
    }

    /**
     * Returns a detailed public representation of the mission slot template instance, as transmitted via API
     *
     * @returns {Promise<IDetailedPublicMissionSlotTemplate>} Object containing detailed public mission slot template information
     * @memberof MissionSlotTemplate
     */
    public async toDetailedPublicObject(): Promise<IDetailedPublicMissionSlotTemplate> {
        if (_.isNil(this.creator)) {
            this.creator = await this.getCreator();
        }
        const publicCreator = await this.creator.toPublicObject();

        const slotGroupCount = this.slotGroups.length;
        const slotCount = _.reduce(
            this.slotGroups, (total: number, slotGroup: IMissionSlotTemplateSlotGroup) => {
                return total + slotGroup.slots.length;
            },
            0);

        return {
            uid: this.uid,
            title: this.title,
            slotGroupCount,
            slotCount,
            slotGroups: this.slotGroups,
            visibility: this.visibility,
            creator: publicCreator
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public mission slot template information as transmitted via API
 *
 * @export
 * @interface IPublicMissionSlotTemplate
 */
export interface IPublicMissionSlotTemplate {
    uid: string;
    title: string;
    slotGroupCount: number;
    slotCount: number;
    visibility: string;
    creator: IPublicUser | null;
}

/**
 * Detailed public mission slot template information as transmitted via API
 *
 * @export
 * @interface IDetailedPublicMissionSlotTemplate
 * @extends {IPublicMissionSlotTemplate}
 */
export interface IDetailedPublicMissionSlotTemplate extends IPublicMissionSlotTemplate {
    slotGroups: IMissionSlotTemplateSlotGroup[];
}

/**
 * Information stored about a template slot group
 *
 * @export
 * @interface IMissionSlotTemplateSlotGroup
 */
export interface IMissionSlotTemplateSlotGroup {
    description: string;
    orderNumber: number;
    slots: IMissionSlotTemplateSlot[];
    title: string;
}

/**
 * Information stored about a template slot
 *
 * @export
 * @interface IMissionSlotTemplateSlot
 */
export interface IMissionSlotTemplateSlot {
    blocked: boolean;
    description: string | null;
    detailedDescription: string | null;
    difficulty: number;
    orderNumber: number;
    reserve: boolean;
    title: string;
}
