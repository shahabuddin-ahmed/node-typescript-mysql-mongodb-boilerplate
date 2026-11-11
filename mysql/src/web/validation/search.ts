import Joi from "joi";
import { CabinClass, TripType } from "../../constant/search";

const searchDate = Joi.string().isoDate().strict();
const airportCode = Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z]{3}$/);

export const flightSearchSchema = Joi.object({
    origin: airportCode.required(),
    destination: airportCode.invalid(Joi.ref("origin")).required(),
    departureDate: searchDate.required(),
    tripType: Joi.string()
        .valid(...Object.values(TripType))
        .required(),
    returnDate: Joi.when("tripType", {
        is: TripType.ROUND_TRIP,
        then: searchDate.required(),
        otherwise: Joi.forbidden(),
    }),
    adults: Joi.number().integer().min(1).max(7).required(),
    children: Joi.number().integer().min(0).max(5).default(0),
    infants: Joi.number()
        .integer()
        .min(0)
        .max(Joi.expression("{adults / 2}"))
        .default(0),
    cabinClass: Joi.string()
        .valid(...Object.values(CabinClass))
        .default(CabinClass.ECONOMY),
})
    .assert(
        Joi.expression("{.adults + .children + .infants}"),
        Joi.number().max(7),
    )
    .required();

export const hotelSearchSchema = Joi.object({
    destination: Joi.string().trim().min(2).max(100).required(),
    checkIn: searchDate.required(),
    checkOut: searchDate.required(),
    rooms: Joi.number().integer().min(1).max(6).default(1),
    adults: Joi.number()
        .integer()
        .min(1)
        .max(Joi.expression("{rooms * 4}"))
        .required(),
    children: Joi.number()
        .integer()
        .min(0)
        .max(Joi.expression("{rooms * 2}"))
        .default(0),
    childAges: Joi.array()
        .items(Joi.number().integer().min(0).max(17))
        .default([]),
}).required();
