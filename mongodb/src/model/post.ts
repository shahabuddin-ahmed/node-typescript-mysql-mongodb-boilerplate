export interface PostInterface {
    id?: string;
    title: string;
    content: string;
    author?: string;
    tags?: string[];
    published?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export class PostModel implements PostInterface {
    id?: string;
    title: string;
    content: string;
    author: string;
    tags: string[];
    published: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;

    constructor(post: PostInterface) {
        const {
            id,
            title,
            content,
            author,
            tags,
            published,
            createdAt,
            updatedAt,
        } = post;

        const now = new Date();
        this.id = id;
        this.title = title;
        this.content = content;
        this.author = author ?? "anonymous";
        this.tags = tags ?? [];
        this.published = published ?? false;
        this.createdAt = createdAt ?? now;
        this.updatedAt = updatedAt ?? this.createdAt;
    }
}

export const newPostModel = async (post: PostInterface) => {
    return new PostModel(post);
};
