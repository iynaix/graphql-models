import isEmpty from "lodash/isEmpty"
import mapKeys from "lodash/mapKeys"
import mapValues from "lodash/mapValues"
import { mergeMongoQueries, pprint } from "./utils"

export const searchNumeric = (fieldName, fieldValue) => {
    return { [fieldName]: mapKeys(fieldValue, (_, k) => k.replace("_", "$")) }
}

// searchNumeric is just a superset of searchBoolean!
export const searchBoolean = searchNumeric

// utility function for handling search operations
const _stringOperator = ([op, val]) => {
    switch (op) {
        case "_eq":
            return { $eq: val }
        case "_ne":
            return { $ne: val }
        case "_ieq":
            return { $regex: val, $options: "i" }
        case "_regex":
            return { $regex: val }
        case "_iregex":
            return { $regex: val, $options: "i" }
        case "_contains":
            return { $regex: val }
        case "_icontains":
            return { $regex: val, $options: "i" }
        case "_startswith":
            return { $regex: `^${val}` }
        case "_istartswith":
            return { $regex: `^${val}`, $options: "i" }
        case "_endswith":
            return { $regex: `${val}$` }
        case "_iendswith":
            return { $regex: `${val}$`, $options: "i" }
        case "_in":
            return { $in: val }
        case "_nin":
            return { $nin: val }
        default:
            throw Error(`Invalid string operation: ${op}`)
    }
}

export const searchString = (fieldName, fieldValue) => {
    const mongoParams = Object.entries(fieldValue).map(_stringOperator)

    return {
        $and: mongoParams.map((v) => ({
            [fieldName]: v,
        })),
    }
}

export const searchWhereRecursive = (searchParams, searchFunc) => {
    if (!searchParams) {
        return {}
    }

    const { _or, _and, _not, ...rest } = searchParams
    const queries = [searchFunc(rest)]

    // handle special mongodb operators
    if (!isEmpty(_or)) {
        queries.push({
            $or: _or.map((v) => searchWhereRecursive(v, searchFunc)),
        })
    }

    if (!isEmpty(_and)) {
        queries.push({
            $and: _and.map((v) => searchWhereRecursive(v, searchFunc)),
        })
    }

    // $not is not a mongodb top level operator, need to wrap with $and
    if (!isEmpty(_not)) {
        queries.push({
            $and: _not.map(({ _not: innerNot = [], ...other }) =>
                mergeMongoQueries(
                    // handle recursive _not first
                    ...innerNot.map((v) => searchWhereRecursive(v, searchFunc)),
                    // wrap remaining keys with $not
                    mapValues(other, (v) => ({ $not: v }))
                )
            ),
        })
    }

    return mergeMongoQueries(...queries)
}
