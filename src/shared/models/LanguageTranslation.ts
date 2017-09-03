import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';

import { Language } from './Language';

/**
 * Represents a language translation in database.
 * Provides database access and utility functionality for language translation instances
 *
 * @export
 * @class LanguageTranslation
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'languageTranslations',
    paranoid: false,
    indexes: [
        {
            name: 'languageTranslations_unique_languageShortCode_key',
            fields: ['languageShortCode', 'key'],
            unique: true
        }
    ]
})
export class LanguageTranslation extends Model {
    /**
     * Associations of the language translation model
     *
     * @static
     * @type {{
     *         language: BelongsTo
     *     }}
     * @memberof LanguageTranslation
     */
    public static associations: {
        language: BelongsTo
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the language translation in the database
     *
     * @type {string}
     * @memberof LanguageTranslation
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Key to replace for language translation
     *
     * @type {string}
     * @memberof LanguageTranslation
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public key: string;

    /**
     * Value to replace the language translation with
     *
     * @type {string}
     * @memberof LanguageTranslation
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    })
    public value: string;

    /**
     * UID of the language the translations is associated with
     *
     * @type {string}
     * @memberof CommunityApplication
     */
    @Attribute({
        type: DataTypes.STRING(2),
        allowNull: false,
        references: {
            model: Language,
            key: 'shortCode'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })
    public languageShortCode: string;

    /**
     * Eager-loaded instance of the language the translation is associated with.
     * Only included if it has been eager-loaded via sequelize
     *
     * @type {Language|undefined}
     * @memberof CommunityApplication
     */
    public language?: Language;

    /**
     * Time (and date) the language translation instance was created
     *
     * @type {Date}
     * @memberof LanguageTranslation
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the language translation instance was last updated
     *
     * @type {Date}
     * @memberof LanguageTranslation
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
     * Retrieves the translation's language instance
     *
     * @type {BelongsToGetAssociationMixin<Language>}
     * @returns {Promise<Language>} Language instance
     * @memberof LanguageTranslation
     */
    public getLanguage: BelongsToGetAssociationMixin<Language>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the language translation instance, as transmitted via API
     *
     * @returns {Promise<IPublicLanguageTranslation>} Object containing public language translation information
     * @memberof LanguageTranslation
     */
    public async toPublicObject(): Promise<IPublicLanguageTranslation> {
        return {
            key: this.key,
            value: this.value,
            languageShortCode: this.languageShortCode
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

/**
 * Public language translation information as transmitted via API
 *
 * @export
 * @interface IPublicLanguageTranslation
 */
export interface IPublicLanguageTranslation {
    key: string;
    value: string;
    languageShortCode: string;
}
