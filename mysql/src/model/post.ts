import { Model, DataTypes } from "sequelize";
import newSequelize from "../infra/sequelize";

export interface PostInterface {
    id?: number;
    title: string;
    content: string;
    author?: string;
    tags?: string[];
    published?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

class Post extends Model<PostInterface> implements PostInterface {
    public id?: number;
    public title!: string;
    public content!: string;
    public author?: string;
    public tags?: string[];
    public published?: boolean;
    public readonly createdAt?: Date;
    public readonly updatedAt?: Date;
}

Post.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        title: {
            type: new DataTypes.STRING(150),
            allowNull: false,
        },
        content: {
            type: new DataTypes.TEXT,
            allowNull: false,
        },
        author: {
            type: new DataTypes.STRING(100),
            allowNull: false,
            defaultValue: "anonymous",
        },
        tags: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
        },
        published: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    },
    {
        tableName: "posts",
        freezeTableName: true,
        timestamps: true,
        underscored: false,
        sequelize: newSequelize(),
        modelName: "posts",
    }
);

export default Post;
