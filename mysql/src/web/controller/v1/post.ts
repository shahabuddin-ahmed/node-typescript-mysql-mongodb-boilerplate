import { Request, Response } from "express";
import Joi from "joi";
import { Controller } from "../controller";
import { PostServiceInterface } from "../../../service/post";

export interface PostControllerInterface {
    create(req: Request, res: Response): any;
    list(req: Request, res: Response): any;
    getById(req: Request, res: Response): any;
    update(req: Request, res: Response): any;
    remove(req: Request, res: Response): any;
}

export class PostController extends Controller implements PostControllerInterface {
    constructor(private postService: PostServiceInterface) {
        super();
        this.create = this.create.bind(this);
        this.list = this.list.bind(this);
        this.getById = this.getById.bind(this);
        this.update = this.update.bind(this);
        this.remove = this.remove.bind(this);
    }

    async create(req: Request, res: Response): Promise<any> {
        const schema = Joi.object({
            title: Joi.string().min(1).required(),
            content: Joi.string().min(1).required(),
            author: Joi.string().optional(),
            tags: Joi.array().items(Joi.string()).default([]),
            published: Joi.boolean().default(false),
            createdAt: Joi.date().iso().optional(),
            updatedAt: Joi.date().iso().optional(),
        });

        const { value } = await this.validateRequest(schema, req.body);
        const data = await this.postService.create(value);
        return this.sendResponse({ response: data }, 201, res);
    }

    async list(req: Request, res: Response): Promise<any> {
        const schema = Joi.object({
            offset: Joi.number().integer().min(0).default(0),
            limit: Joi.number().integer().min(1).max(100).default(25),
        });

        const { value } = await this.validateRequest(schema, req.query);
        const data = await this.postService.list(value.offset, value.limit);
        return this.sendResponse({ response: data }, 200, res);
    }

    async getById(req: Request, res: Response): Promise<any> {
        const schema = Joi.object({
            id: Joi.number().integer().positive().required(),
        });

        const { value } = await this.validateRequest(schema, req.params);
        const data = await this.postService.getById(value.id);
        return this.sendResponse({ response: data }, 200, res);
    }

    async update(req: Request, res: Response): Promise<any> {
        const paramSchema = Joi.object({
            id: Joi.number().integer().positive().required(),
        });

        const bodySchema = Joi.object({
            title: Joi.string().min(1).optional(),
            content: Joi.string().min(1).optional(),
            author: Joi.string().optional(),
            tags: Joi.array().items(Joi.string()).optional(),
            published: Joi.boolean().optional(),
            updatedAt: Joi.date().iso().optional(),
        }).min(1);

        const { value: params } = await this.validateRequest(
            paramSchema,
            req.params
        );
        const { value: body } = await this.validateRequest(bodySchema, req.body);

        const data = await this.postService.update(params.id, body);
        return this.sendResponse({ response: data }, 200, res);
    }

    async remove(req: Request, res: Response): Promise<any> {
        const schema = Joi.object({
            id: Joi.number().integer().positive().required(),
        });

        const { value } = await this.validateRequest(schema, req.params);
        await this.postService.remove(value.id);
        return this.sendResponse({ response: { deleted: true } }, 200, res);
    }
}

export const newPostV1Controller = async (
    postService: PostServiceInterface
): Promise<PostController> => {
    return new PostController(postService);
};
