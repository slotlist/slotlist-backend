import { DataTypes } from 'sequelize';

/**
 * Delete unused LanguageTranslations table
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.dropTable('languageTranslations');
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.createTable('languageTranslations', {
            uid: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            key: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            value: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            languageShortCode: {
                type: DataTypes.STRING(2),
                allowNull: false,
                references: {
                    model: 'languages',
                    key: 'shortCode'
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });

        await queryInterface.addIndex('languageTranslations', ['languageShortCode', 'key'], {
            indexName: 'languageTranslations_unique_languageShortCode_key',
            indicesType: 'UNIQUE',
            indexType: 'BTREE'
        });
    }
};
