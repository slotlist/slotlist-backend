import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';

import { MissionSlot } from './MissionSlot';
import { IPublicUser, User } from './User';

/**
 * Represents a mission slot registration in database.
 * Provides database access and utility functionality for mission slot registration instances
 *
 * @export
 * @class MissionSlotRegistration
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'missionSlotRegistrations',
    paranoid: false,
    indexes: [
        {
            name: 'missionSlotRegistrations_unique_slotUid_userUid',
            fields: ['slotUid', 'userUid'],
            unique: true
        }
    ]
})
export class MissionSlotRegistration extends Model {
    /**
     * Associations of the mission slot model
     *
     * @static
     * @type {{
     *         slot: BelongsTo,
     *         user: BelongsTo
     *     }}
     * @memberof MissionSlotRegistration
     */
    public static associations: {
        slot: BelongsTo;
        user: BelongsTo;
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the mission slot registration in the database
     *
     * @type {string}
     * @memberof MissionSlotRegistration
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Indicates whether the mission slot registration has been confirmed by the mission creator and the user has been assigned to the slot
     *
     * @type {boolean}
     * @memberof MissionSlotRegistration
     */
    @Attribute({
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    })
    public confirmed: boolean;

    /**
     * Optional comment provided by the user during registration, can e.g. be used to state preferences
     *
     * @type {(string | null)}
     * @memberof MissionSlotRegistration
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        validate: {
            notEmpty: true
        }
    })
    public comment: string | null;

    /**
     * UID of the mission slot the registration is associated with.
     *
     * @type {string}
     * @memberof MissionSlotRegistration
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: MissionSlot,
            key: 'uid'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })
    public slotUid: string;

    /**
     * Eager-loaded mission slot instance.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(MissionSlot | undefined)}
     * @memberof MissionSlotRegistration
     */
    public slot?: MissionSlot;

    /**
     * UID of the user that has registered for the mission slot.
     *
     * @type {string}
     * @memberof MissionSlotRegistration
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
    public userUid: string;

    /**
     * Eager-loaded assigned user instance.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {(User | undefined)}
     * @memberof MissionSlotRegistration
     */
    public user?: User;

    /**
     * Time (and date) the mission slot registration instance was created
     *
     * @type {Date}
     * @memberof MissionSlotRegistration
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the mission slot registration instance was last updated
     *
     * @type {Date}
     * @memberof MissionSlotRegistration
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
     * Retrieves the registration's slot instance.
     *
     * @type {BelongsToGetAssociationMixin<MissionSlot>}
     * @returns {Promise<MissionSlot>} Mission slot instance
     * @memberof MissionSlotRegistration
     */
    public getSlot: BelongsToGetAssociationMixin<MissionSlot>;

    /**
     * Retrieves the registration's assigned user instance.
     *
     * @type {BelongsToGetAssociationMixin<User>}
     * @returns {Promise<User>} User instance
     * @memberof MissionSlotRegistration
     */
    public getUser: BelongsToGetAssociationMixin<User>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the mission slot registration instance, as transmitted via API
     *
     * @param {boolean} [includeDetails=false] Allows for slot registration details such as the UID or comment to be included
     * @returns {Promise<IPublicMissionSlotRegistration>} Object containing public mission slot registration information
     * @memberof MissionSlotRegistration
     */
    public async toPublicObject(includeDetails: boolean = false): Promise<IPublicMissionSlotRegistration> {
        if (_.isNil(this.user)) {
            this.user = await this.getUser();
        }
        const publicUser = await this.user.toPublicObject();

        return {
            uid: includeDetails ? this.uid : undefined,
            confirmed: this.confirmed,
            comment: includeDetails ? (_.isNil(this.comment) ? null : this.comment) : undefined,
            slotUid: this.slotUid,
            user: publicUser,
            createdAt: this.createdAt
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public mission slot registration information as transmitted via API
 *
 * @export
 * @interface IPublicMissionSlotRegistration
 */
export interface IPublicMissionSlotRegistration {
    uid?: string;
    confirmed: boolean;
    comment?: string | null;
    slotUid: string;
    user: IPublicUser;
    createdAt: Date;
}
