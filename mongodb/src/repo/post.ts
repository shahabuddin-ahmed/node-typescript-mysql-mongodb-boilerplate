import { ObjectId } from "mongodb";
import { DBInterface } from "../infra/db";
import { PostInterface } from "../model/post";

export interface PostRepoInterface {
    create(post: PostInterface): Promise<PostInterface>;
    findById(id: string): Promise<PostInterface | null>;
    list(offset: number, limit: number): Promise<PostInterface[]>;
    update(id: string, update: Partial<PostInterface>): Promise<PostInterface | null>;
    delete(id: string): Promise<boolean>;
    count(): Promise<number>;
}

export class PostRepo implements PostRepoInterface {
    constructor(private db: DBInterface, private collection: string) {
        this.db = db;
        this.collection = collection;
    }

    private buildObjectId(id: string): ObjectId | null {
        if (!ObjectId.isValid(id)) {
            return null;
        }
        return new ObjectId(id);
    }

    public async create(post: PostInterface): Promise<PostInterface> {
        return this.db.create(this.collection, post);
    }

    public async findById(id: string): Promise<PostInterface | null> {
        const objectId = this.buildObjectId(id);
        if (!objectId) {
            return null;
        }
        return this.db.findOne(this.collection, { _id: objectId });
    }

    public async list(
        offset: number,
        limit: number
    ): Promise<PostInterface[]> {
        return this.db.find(
            this.collection,
            {},
            { limit, skip: offset, sort: { createdAt: -1 } }
        );
    }

    public async update(
        id: string,
        update: Partial<PostInterface>
    ): Promise<PostInterface | null> {
        const objectId = this.buildObjectId(id);
        if (!objectId) {
            return null;
        }

        const payload = { ...update };
        delete (payload as any).id;

        return this.db.update(this.collection, { _id: objectId }, payload);
    }

    public async delete(id: string): Promise<boolean> {
        const objectId = this.buildObjectId(id);
        if (!objectId) {
            return false;
        }
        return this.db.delete(this.collection, { _id: objectId });
    }

    public async count(): Promise<number> {
        return this.db.count(this.collection, {});
    }
}

export const newPostRepo = async (
    db: DBInterface,
    collection: string
): Promise<PostRepoInterface> => {
    return new PostRepo(db, collection);
};

export default PostRepo;
