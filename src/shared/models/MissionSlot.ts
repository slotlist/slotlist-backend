import * as Boom from 'boom';
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

import { Community, IPublicCommunity } from './Community';
import { MISSION_REQUIRED_DLCS } from './Mission';
import { MissionSlotGroup } from './MissionSlotGroup';
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
            name: 'missionSlots_unique_slotGroupUid_assigneeUid',
            fields: ['slotGroupUid', 'assigneeUid'],
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
     *         registrations: HasMany,
     *         restrictedCommunity: BelongsTo,
     *         slotGroup: BelongsTo
     *     }}
     * @memberof MissionSlot
     */
    public static associations: {
        assignee: BelongsTo;
        registrations: HasMany;
        restrictedCommunity: BelongsTo;
        slotGroup: BelongsTo;
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
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public title: string;

    /**
     * Order number for sorting slots within a slot group
     *
     * @type {number}
     * @memberof MissionSlot
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
     * Difficulity of the mission slot, ranging from 0 (easiest) to 4 (hardest)
     *
     * @type {number}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.INTEGER,
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
     * Can be `null` if not required
     *
     * @type {(string | null)}
     * @memberof MissionSlot
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
     * Detailed, optional description of the mission slot, further explaining the responsibilities and the selected role.
     * Can be `null` if not required.
     * Can contain HTML for formatting
     *
     * @type {(string | null)}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true
        }
    })
    public detailedDescription: string | null;

    /**
     * Indicates whether the slot is a reserve slot (true, will only be assigned if all other slots have been filled) or a regular one (false)
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
     * Indicates whether the slot is a blocked slot (true, no users can register) or a regular one (false)
     * Blocked slots can be used by mission creators to manually "assign" slots to community or users that choose not to use slotlist.info
     *
     * @type {boolean}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    })
    public blocked: boolean;

    /**
     * Indicates whether the slot is auto-assignable. Auto-assignable slots do not require confirmation by a mission editor, but are automatically
     * assigned to the first registering user (who would have thought, what a good name choice!).
     *
     * @type {boolean}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    })
    public autoAssignable: boolean;

    /**
     * List of DLCs required to fulfil the duties assigned to the slot.
     * Currently not used in any restrictions, but merely added as an indication to players.
     *
     * @type {string[]}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
        validate: {
            validRequiredDLC(val: any): void {
                let localVal = val;
                if (!_.isArray(localVal)) {
                    localVal = [localVal];
                }

                _.each(localVal, (dlc: string) => {
                    if (_.indexOf(MISSION_REQUIRED_DLCS, dlc) === -1) {
                        throw Boom.badRequest('Invalid mission slot required DLC', dlc);
                    }
                });
            }
        }
    })
    public requiredDLCs: string[];

    /**
     * UID of the user that has been assigned to the slot.
     * Cannot be set at the same time as an `externalAssignee` and vice versa.
     * Can be `null` if no final assignment has been made yet
     *
     * @type {(string | null)}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        validate: {
            eitherAssigneeUidOrExternalAssigne(val: any): void {
                if (!_.isNil(val) && !_.isNil(this.externalAssignee)) {
                    throw Boom.conflict('Mission slot can only either have assignee or external assignee');
                }
            }
        },
        references: {
            model: User,
            key: 'uid'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
    })
    public assigneeUid: string | null;

    /**
     * Eager-loaded assigned user instance.
     * Only included if the slot has a user assigned and it has been eager-loaded via sequelize
     *
     * @type {(User | null | undefined)}
     * @memberof MissionSlot
     */
    public assignee?: User | null;

    /**
     * Nickname of external player assigned to the slot. Allows for slots to be assigned to users not present in the database.
     * Cannot be set at the same time as an `assigneeUid` and vice versa.
     * Can be `null` if no external player has been assigned.
     *
     * @type {(string | null)}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true,
            eitherAssigneeUidOrExternalAssigne(val: any): void {
                if (!_.isNil(val) && !_.isNil(this.assigneeUid)) {
                    throw Boom.conflict('Mission slot can only either have assignee or external assignee');
                }
            }
        }
    })
    public externalAssignee: string | null;

    /**
     * Eager-loaded list of slot registrations associated with this slot.
     * Only included if the slot has registrations associated and it has been eager-loaded via sequelize
     *
     * @type {(MissionSlotRegistration[] | undefined)}
     * @memberof MissionSlot
     */
    public registrations?: MissionSlotRegistration[];

    /**
     * UID of the community the slot is restricted to. If set, only members of this community can register for the slot.
     * Setting this to `null` removes the restrictions and opens the slot to everyone
     *
     * @type {(string | null)}
     * @memberof MissionSlot
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
    public restrictedCommunityUid: string | null;

    /**
     * Eager-loaded instance of restricted community.
     * Only included if the slot is restricted to a community and it has been eager-loaded via sequelize
     *
     * @type {(Community | null | undefined)}
     * @memberof MissionSlot
     */
    public restrictedCommunity?: Community | null;

    /**
     * UID of the slot groups the slot is associated with.
     *
     * @type {string}
     * @memberof MissionSlot
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: MissionSlotGroup,
            key: 'uid'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })
    public slotGroupUid: string;

    /**
     * Eager-loaded slot group instance.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(MissionSlotGroup | undefined)}
     * @memberof MissionSlot
     */
    public slotGroup?: MissionSlotGroup;

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
     * Retrieves the slot's registration instances.
     * Returns an empty array if the slot has no registrations assigned
     *
     * @type {HasManyGetAssociationsMixin<MissionSlotRegistration>}
     * @returns {Promise<MissionSlotRegistration[]>} List of slot registations
     * @memberof MissionSlot
     */
    public getRegistrations: HasManyGetAssociationsMixin<MissionSlotRegistration>;

    /**
     * Retrieves the slot's restricted community instance.
     * Only returns a result if the slot has been restricted to a community
     *
     * @type {BelongsToGetAssociationMixin<Community>}
     * @returns {Promise<MissionSlotRegistration[]>} Community the slot was restricted to
     * @memberof MissionSlot
     */
    public getRestrictedCommunity: BelongsToGetAssociationMixin<Community>;

    /**
     * Retrieves the slot's slot group instance.
     *
     * @type {BelongsToGetAssociationMixin<MissionSlotGroup>}
     * @returns {Promise<Mission>} Slot group instance
     * @memberof MissionSlot
     */
    public getSlotGroup: BelongsToGetAssociationMixin<MissionSlotGroup>;

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

    /**
     * Sets the slot's restricted community to the given community or a community with the provided UID.
     * Passing `undefined|null` removes the association.
     * Overwrites any former assignment (if it exists)
     *
     * @type {BelongsToSetAssociationMixin<Community>}
     * @returns {Promise<void>} Promise fulfilled when association is completed
     * @memberof MissionSlot
     */
    public setRestrictedCommunity: BelongsToSetAssociationMixin<Community, string>;

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
        if (!_.isNil(this.assigneeUid)) {
            if (_.isNil(this.assignee)) {
                this.assignee = await this.getAssignee();
            }
        }

        if (_.isNil(this.registrations)) {
            this.registrations = await this.getRegistrations();
        }

        if (!_.isNil(this.restrictedCommunityUid)) {
            if (_.isNil(this.restrictedCommunity)) {
                this.restrictedCommunity = await this.getRestrictedCommunity();
            }
        }

        const [publicAssignee, publicRestrictedCommunity] = await Promise.all([
            !_.isNil(this.assigneeUid) && !_.isNil(this.assignee) ? this.assignee.toPublicObject() : Promise.resolve(null),
            !_.isNil(this.restrictedCommunityUid) && !_.isNil(this.restrictedCommunity) ? this.restrictedCommunity.toPublicObject() : Promise.resolve(null)
        ]);

        return {
            uid: this.uid,
            slotGroupUid: this.slotGroupUid,
            title: this.title,
            orderNumber: this.orderNumber,
            difficulty: this.difficulty,
            description: _.isNil(this.description) ? null : this.description,
            detailedDescription: _.isNil(this.detailedDescription) ? null : this.detailedDescription,
            restrictedCommunity: publicRestrictedCommunity,
            reserve: this.reserve,
            blocked: this.blocked,
            autoAssignable: this.autoAssignable,
            requiredDLCs: this.requiredDLCs,
            assignee: publicAssignee,
            externalAssignee: _.isNil(this.externalAssignee) ? null : this.externalAssignee,
            registrationCount: this.registrations.length
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
    slotGroupUid: string;
    title: string;
    orderNumber: number;
    difficulty: number;
    detailedDescription: string | null;
    description: string | null;
    restrictedCommunity: IPublicCommunity | null;
    reserve: boolean;
    blocked: boolean;
    autoAssignable: boolean;
    requiredDLCs: string[];
    assignee: IPublicUser | null;
    externalAssignee: string | null;
    registrationCount: number;
    registrationUid?: string; // only returned if user has registered for the slot
}

/**
 * Information received while creating a mission slot
 *
 * @export
 * @interface IMissionSlotCreatePayload
 */
export interface IMissionSlotCreatePayload {
    slotGroupUid: string;
    title: string;
    orderNumber: number;
    difficulty: number;
    detailedDescription: string | null;
    description: string | null;
    restrictedCommunityUid: string | null;
    reserve: boolean;
    blocked: boolean;
    autoAssignable: boolean;
    insertAfter: number;
}
