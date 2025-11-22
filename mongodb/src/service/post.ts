import { ERROR_CODES } from "../constant/error";
import { PostInterface } from "../model/post";
import { PostRepoInterface } from "../repo/post";
import { NotFoundException } from "../web/exception/not-found-exception";

export interface PostServiceInterface {
    create(post: PostInterface): Promise<PostInterface>;
    getById(id: string): Promise<PostInterface>;
    list(
        offset: number,
        limit: number
    ): Promise<{
        data: PostInterface[];
        offset: number;
        limit: number;
        total: number;
    }>;
    update(id: string, update: Partial<PostInterface>): Promise<PostInterface>;
    remove(id: string): Promise<boolean>;
}

export class PostService implements PostServiceInterface {
    constructor(private repo: PostRepoInterface) {
        this.repo = repo;
    }

    async create(post: PostInterface): Promise<PostInterface> {
        const now = new Date();
        const payload: PostInterface = {
            ...post,
            tags: post.tags ?? [],
            published: post.published ?? false,
            createdAt: post.createdAt ?? now,
            updatedAt: post.updatedAt ?? now,
        };

        return this.repo.create(payload);
    }

    async getById(id: string): Promise<PostInterface> {
        const post = await this.repo.findById(id);
        if (!post) {
            throw new NotFoundException(ERROR_CODES.E_PAGE_NOT_FOUND, "Post not found");
        }
        return post;
    }

    async list(
        offset: number,
        limit: number
    ): Promise<{
        data: PostInterface[];
        offset: number;
        limit: number;
        total: number;
    }> {
        const data = await this.repo.list(offset, limit);
        const total = await this.repo.count();

        return { data, offset, limit, total };
    }

    async update(
        id: string,
        update: Partial<PostInterface>
    ): Promise<PostInterface> {
        const payload = {
            ...update,
            updatedAt: update.updatedAt ?? new Date(),
        };
        const updated = await this.repo.update(id, payload);
        if (!updated) {
            throw new NotFoundException(ERROR_CODES.E_PAGE_NOT_FOUND, "Post not found");
        }
        return updated;
    }

    async remove(id: string): Promise<boolean> {
        const removed = await this.repo.delete(id);
        if (!removed) {
            throw new NotFoundException(ERROR_CODES.E_PAGE_NOT_FOUND, "Post not found");
        }
        return removed;
    }
}

export const newPostService = async (
    repo: PostRepoInterface
): Promise<PostService> => {
    return new PostService(repo);
};
