import { Model, DataTypes, Optional } from "sequelize";
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

type PostCreationAttributes = Optional<
    PostInterface,
    "id" | "author" | "tags" | "published" | "createdAt" | "updatedAt"
>;

class Post
    extends Model<PostInterface, PostCreationAttributes>
    implements PostInterface
{
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
            primaryKey: true,
            autoIncrement: true,
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        author: {
            type: DataTypes.STRING(100),
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
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: "posts",
        freezeTableName: true,
        timestamps: true,
        underscored: false,
        sequelize: newSequelize(),
        modelName: "post",
    }
);

export default Post;
