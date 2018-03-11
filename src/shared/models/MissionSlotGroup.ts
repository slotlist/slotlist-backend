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

import sequelize from '../util/sequelize';

import { Mission } from './Mission';
import { IPublicMissionSlot, MissionSlot } from './MissionSlot';

/**
 * Represents a mission slot group in database.
 * Provides database access and utility functionality for mission slot group instances
 *
 * @export
 * @class MissionSlotGroup
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'missionSlotGroups',
    paranoid: false
})
export class MissionSlotGroup extends Model {
    /**
     * Associations of the mission slot group model
     *
     * @static
     * @type {{
     *         mission: BelongsTo,
     *         slots: HasMany
     *     }}
     * @memberof MissionSlotGroup
     */
    public static associations: {
        mission: BelongsTo;
        slots: HasMany;
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the mission slot group in the database
     *
     * @type {string}
     * @memberof MissionSlotGroup
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Title of the mission slot group
     *
     * @type {string}
     * @memberof MissionSlotGroup
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
     * Order number for sorting group in slotlist
     *
     * @type {number}
     * @memberof MissionSlotGroup
     */
    @Attribute({
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        }
    })
    public orderNumber: number;

    /**
     * Short, optional description of the mission slot group, describing the selected group.
     * Can be `null` if not required
     *
     * @type {(string | null)}
     * @memberof MissionSlotGroup
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true
        }
    })
    public description: string | null;

    /**
     * UID of the mission the slot group is associated with.
     *
     * @type {string}
     * @memberof MissionSlotGroup
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Mission,
            key: 'uid'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })
    public missionUid: string;

    /**
     * Eager-loaded mission instance.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(Mission | undefined)}
     * @memberof MissionSlotGroup
     */
    public mission?: Mission;

    /**
     * Eager-loaded list of slots associated with this slot group.
     * Only included if the group has slots associated and it has been eager-loaded via sequelize
     *
     * @type {(MissionSlot[] | undefined)}
     * @memberof MissionSlotGroup
     */
    public slots?: MissionSlot[];

    /**
     * Time (and date) the mission slot group instance was created
     *
     * @type {Date}
     * @memberof MissionSlotGroup
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the mission slot group instance was last updated
     *
     * @type {Date}
     * @memberof MissionSlotGroup
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
     * Creates a new slot for the current mission slot group
     *
     * @type {HasManyCreateAssociationMixin<MissionSlot>}
     * @returns {Promise<MissionSlot>} Mission slot created
     * @memberof MissionSlotGroup
     */
    public createSlot: HasManyCreateAssociationMixin<MissionSlot>;

    /**
     * Retrieves the slot group's mission instance.
     *
     * @type {BelongsToGetAssociationMixin<Mission>}
     * @returns {Promise<Mission>} Mission instance
     * @memberof MissionSlotGroup
     */
    public getMission: BelongsToGetAssociationMixin<Mission>;

    /**
     * Retrieves the slot group's slot instances.
     * Returns an empty array if the group has no slots assigned
     *
     * @type {HasManyGetAssociationsMixin<MissionSlot>}
     * @returns {Promise<MissionSlot[]>} List of slots
     * @memberof MissionSlotGroup
     */
    public getSlots: HasManyGetAssociationsMixin<MissionSlot>;

    /**
     * Removes the given slot or a slot with the provided UID from the mission slot group
     *
     * @type {HasManyRemoveAssociationMixin<MissionSlot, string>}
     * @returns {Promise<void>} Promise fulfilled when removal is completed
     * @memberof MissionSlotGroup
     */
    public removeSlot: HasManyRemoveAssociationMixin<MissionSlot, string>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the mission slot group instance, as transmitted via API
     *
     * @returns {Promise<IPublicMissionSlotGroup>} Object containing public mission slot group information
     * @memberof MissionSlotGroup
     */
    public async toPublicObject(): Promise<IPublicMissionSlotGroup> {
        if (_.isNil(this.slots)) {
            this.slots = await this.getSlots();
        }

        const publicSlots = await Promise.map(this.slots, (slot: MissionSlot) => {
            return slot.toPublicObject();
        });

        return {
            uid: this.uid,
            missionUid: this.missionUid,
            title: this.title,
            orderNumber: this.orderNumber,
            description: _.isNil(this.description) ? null : this.description,
            slots: _.orderBy(publicSlots, ['orderNumber', (s: IPublicMissionSlot) => { return s.title.toUpperCase(); }], ['asc', 'asc'])
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public mission slot group information as transmitted via API
 *
 * @export
 * @interface IPublicMissionSlotGroup
 */
export interface IPublicMissionSlotGroup {
    uid: string;
    missionUid: string;
    title: string;
    orderNumber: number;
    description: string | null;
    slots: IPublicMissionSlot[];
}
