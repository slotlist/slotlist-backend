import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    BelongsToSetAssociationMixin,
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
import { MissionSlotRegistration } from './MissionSlotRegistration';
import { IPublicUser, User } from './User';

/**
 * Represents a mission slot in database.
 * Provides database access and utility functionality for mission slot instances
 *
 * @export
 * @class MissionSlot
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'missionSlots',
    paranoid: false,
    indexes: [
        {
            name: 'missionSlots_unique_missionUid_assigneeUid',
            fields: ['missionUid', 'assigneeUid'],
            unique: true
        }
    ]
})
export class MissionSlot extends Model {
    /**
     * Associations of the mission slot model
     *
     * @static
     * @type {{
     *         assignee: BelongsTo,
     *         mission: BelongsTo,
     *         registrations: HasMany
     *     }}
     * @memberof MissionSlot
     */
    public static associations: {
        assignee: BelongsTo,
        mission: BelongsTo,
        registrations: HasMany
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the mission slot in the database
     *
     * @type {string}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Title of the mission slot
     *
     * @type {string}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false
    })
    public title: string;

    /**
     * Difficulity of the mission slot, ranging from 0 (easiest) to 4 (hardest)
     *
     * @type {number}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.INTEGER({ length: 1 }),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0,
            max: 4
        }
    })
    public difficulty: number;

    /**
     * Short, optional description of the mission slot, describing the selected role.
     * Can be `undefined|null` if not required
     *
     * @type {string|undefined|null}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    })
    public shortDescription?: string;

    /**
     * Detailed, optional description of the mission slot, further explaining the responsibilities and the selected role.
     * Can be `undefined|null` if not required.
     * Can contain HTML for formatting
     *
     * @type {string|undefined|null}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    })
    public description?: string;

    /**
     * Indicates whether the slot is restricted (true, not available for public registration) or whether everyone can register (false)
     *
     * @type {boolean}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    })
    public restricted: boolean;

    /**
     * Indicates whether the slot is a reserve slot (true, will only be assigned if all other slots have been filled) or regular one (false)
     *
     * @type {boolean}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    })
    public reserve: boolean;

    /**
     * UID of the user that has been assigned to the slot.
     * Can be `undefined|null` if no final assignment has been made yet
     *
     * @type {string|undefined|null}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
            model: User,
            key: 'uid'
        },
        onDelete: 'SET NULL'
    })
    public assigneeUid?: string;

    /**
     * Eager-loaded assigned user instance.
     * Only included if the mission has a user assigned and it has been eager-loaded via sequelize
     *
     * @type {User|undefined}
     * @memberof MissionSlot
     */
    public assignee?: User;

    /**
     * UID of the mission the slot is associated with.
     *
     * @type {string}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Mission,
            key: 'uid'
        },
        onDelete: 'CASCADE'
    })
    public missionUid: string;

    /**
     * Eager-loaded mission instance.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {Mission|undefined}
     * @memberof MissionSlot
     */
    public mission?: Mission;

    /**
     * Eager-loaded list of slot registrations associated with this slot.
     * Only included if the slot has registrations associated and it has been eager-loaded via sequelize
     *
     * @type {MissionSlotRegistration[]|undefined}
     * @memberof MissionSlot
     */
    public registrations?: MissionSlotRegistration[];

    /**
     * Time (and date) the mission slot instance was created
     *
     * @type {Date}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the mission slot instance was last updated
     *
     * @type {Date}
     * @memberof MissionSlot
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
     * Creates a new registration for the current mission slot
     *
     * @type {HasManyCreateAssociationMixin<MissionSlotRegistration>}
     * @returns {Promise<MissionSlotRegistration>} Mission slot registration created
     * @memberof MissionSlot
     */
    public createRegistration: HasManyCreateAssociationMixin<MissionSlotRegistration>;

    /**
     * Retrieves the slot's assigned user instance.
     * Only returns a result if a user has been assigned to the slot already
     *
     * @type {BelongsToGetAssociationMixin<User>}
     * @returns {Promise<User>} User instance
     * @memberof MissionSlot
     */
    public getAssignee: BelongsToGetAssociationMixin<User>;

    /**
     * Retrieves the slot's mission instance.
     *
     * @type {BelongsToGetAssociationMixin<Mission>}
     * @returns {Promise<Mission>} Mission instance
     * @memberof MissionSlot
     */
    public getMission: BelongsToGetAssociationMixin<Mission>;

    /**
     * Retrieves the slot's registration instances.
     * Returns an empty array if the slot has no registrations assigned
     *
     * @type {HasManyGetAssociationsMixin<MissionSlotRegistration>}
     * @returns {Promise<MissionSlotRegistration[]>} List of slot registations
     * @memberof MissionSlot
     */
    public getRegistrations: HasManyGetAssociationsMixin<MissionSlotRegistration>;

    /**
     * Removes the given registration or a registration with the provided UID from the mission slot
     *
     * @type {HasManyRemoveAssociationMixin<MissionSlotRegistration, string>}
     * @returns {Promise<void>} Promise fulfilled when removal is completed
     * @memberof MissionSlot
     */
    public removeRegistration: HasManyRemoveAssociationMixin<MissionSlotRegistration, string>;

    /**
     * Sets the slot's assignee to the given user or a user with the provided UID.
     * Passing `undefined|null` removes the association.
     * Overwrites any former assignment (if it exists)
     *
     * @type {BelongsToSetAssociationMixin<User>}
     * @returns {Promise<void>} Promise fulfilled when association is completed
     * @memberof MissionSlot
     */
    public setAssignee: BelongsToSetAssociationMixin<User, string>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the mission slot instance, as transmitted via API
     *
     * @returns {Promise<IPublicMissionSlot>} Object containing public mission slot information
     * @memberof MissionSlot
     */
    public async toPublicObject(): Promise<IPublicMissionSlot> {
        let publicAssignee: IPublicUser | null = null;
        if (!_.isNil(this.assigneeUid)) {
            if (_.isNil(this.assignee)) {
                this.assignee = await this.getAssignee();
            }
            publicAssignee = await this.assignee.toPublicObject();
        }

        return {
            uid: this.uid,
            missionUid: this.missionUid,
            title: this.title,
            difficulty: this.difficulty,
            shortDescription: _.isNil(this.shortDescription) ? null : this.shortDescription,
            restricted: this.restricted,
            reserve: this.reserve,
            assignee: publicAssignee
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public mission slot information as transmitted via API
 *
 * @export
 * @interface IPublicMissionSlot
 */
export interface IPublicMissionSlot {
    uid: string;
    missionUid: string;
    title: string;
    difficulty: number;
    shortDescription: string | null;
    restricted: boolean;
    reserve: boolean;
    assignee: IPublicUser | null;
}
