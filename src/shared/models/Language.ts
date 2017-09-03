import * as _ from 'lodash';
import {
    DataTypes,
    HasMany,
    HasManyCreateAssociationMixin,
    HasManyGetAssociationsMixin,
    HasManyRemoveAssociationMixin,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';

import { LanguageTranslation } from './LanguageTranslation';

/**
 * Represents a language in database.
 * Provides database access and utility functionality for language instances
 *
 * @export
 * @class Language
 * @extends {Sequelize.Model}
 */
@Options({
    sequelize,
    tableName: 'languages',
    paranoid: false
})
export class Language extends Model {
    /**
     * Associations of the language model
     *
     * @static
     * @type {{
     *         translations: HasMany
     *     }}
     * @memberof Language
     */
    public static associations: {
        translations: HasMany
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * Short code of the language, also used to uniquely identify it in database
     *
     * @type {string}
     * @memberof Language
     */
    @Attribute({
        type: DataTypes.STRING(2),
        allowNull: false,
        primaryKey: true,
        validate: {
            notEmpty: true
        }
    })
    public shortCode: string;

    /**
     * Name of the language
     *
     * @type {string}
     * @memberof Language
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true
        }
    })
    public name: string;

    /**
     * Eager-loaded list of translations associated with the language.
     * Only included if the language has translations associated and it has been eager-loaded via sequelize
     *
     * @type {LanguageTranslation[]|undefined}
     * @memberof Language
     */
    public translations?: LanguageTranslation[];

    /**
     * Time (and date) the language instance was created
     *
     * @type {Date}
     * @memberof Language
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the language instance was last updated
     *
     * @type {Date}
     * @memberof Language
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
     * Creates a new translation for the current language
     *
     * @type {HasManyCreateAssociationMixin<LanguageTranslation>}
     * @returns {Promise<LanguageTranslation>} Language translation created
     * @memberof Language
     */
    public createTranslation: HasManyCreateAssociationMixin<LanguageTranslation>;

    /**
     * Retrieves the language's translation instances.
     * Returns an empty array if the language has no translations assigned
     *
     * @type {HasManyGetAssociationsMixin<LanguageTranslation>}
     * @returns {Promise<LanguageTranslation[]>} List of language translations
     * @memberof Language
     */
    public getTranslations: HasManyGetAssociationsMixin<LanguageTranslation>;

    /**
     * Removes the given translation or a translation with the provided UID from the language's translation list
     *
     * @type {HasManyRemoveAssociationMixin<LanguageTranslation, string>}
     * @returns {Promise<void>} Promise fulfilled when removal is completed
     * @memberof Language
     */
    public removeTranslation: HasManyRemoveAssociationMixin<LanguageTranslation, string>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    /**
     * Returns a public representation of the language instance, as transmitted via API
     *
     * @returns {Promise<IPublicLanguage>} Object containing public language information
     * @memberof Language
     */
    public async toPublicObject(): Promise<IPublicLanguage> {
        return {
            shortCode: this.shortCode,
            name: this.name
        };
    }

    /**
     * Returns a detailed public representation of the language instance, as transmitted via API.
     * Also includes translations associated
     *
     * @returns {Promise<IDetailedPublicLanguage>} Object containing detailed public language information
     * @memberof Language
     */
    public async toDetailedPublicObject(): Promise<IDetailedPublicLanguage> {
        const translations = await this.getTranslations();
        const translationMap: ILanguageMap = _.reduce(
            translations,
            (map: ILanguageMap, translation: LanguageTranslation) => {
                return map[translation.key] = translation.value;
            },
            {});

        return {
            shortCode: this.shortCode,
            name: this.name,
            translations: translationMap
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////
}

export type ILanguageMap = {
    [key: string]: string;
};

/**
 * Public language information as transmitted via API
 *
 * @export
 * @interface IPublicLanguage
 */
export interface IPublicLanguage {
    shortCode: string;
    name: string;
}

/**
 * Detailed public language information as transmitted via API.
 * Also includes translations associated
 *
 * @export
 * @interface IDetailedPublicLanguage
 * @extends {IPublicLanguage}
 */
export interface IDetailedPublicLanguage extends IPublicLanguage {
    translations: ILanguageMap;
}
