import Post, { PostInterface } from "../model/post";

export interface PostRepoInterface {
    create(post: PostInterface): Promise<PostInterface>;
    findById(id: number): Promise<PostInterface | null>;
    list(offset: number, limit: number): Promise<PostInterface[]>;
    update(id: number, update: Partial<PostInterface>): Promise<PostInterface | null>;
    delete(id: number): Promise<boolean>;
    count(): Promise<number>;
}

export class PostRepo implements PostRepoInterface {
    public async create(post: PostInterface): Promise<PostInterface> {
        const created = await Post.create(post);
        return created.get({ plain: true }) as PostInterface;
    }

    public async findById(id: number): Promise<PostInterface | null> {
        const post = await Post.findByPk(id);
        return post ? (post.get({ plain: true }) as PostInterface) : null;
    }

    public async list(offset: number, limit: number): Promise<PostInterface[]> {
        const posts = await Post.findAll({
            offset,
            limit,
            order: [["createdAt", "DESC"]],
        });
        return posts.map((post) => post.get({ plain: true }) as PostInterface);
    }

    public async update(
        id: number,
        update: Partial<PostInterface>
    ): Promise<PostInterface | null> {
        const post = await Post.findByPk(id);
        if (!post) {
            return null;
        }

        const payload = { ...update };
        delete (payload as any).id;
        const updated = await post.update(payload);
        return updated.get({ plain: true }) as PostInterface;
    }

    public async delete(id: number): Promise<boolean> {
        const deleted = await Post.destroy({ where: { id } });
        return deleted > 0;
    }

    public async count(): Promise<number> {
        return Post.count();
    }
}

export const newPostRepo = async (
): Promise<PostRepoInterface> => {
    return new PostRepo();
};

export default PostRepo;
