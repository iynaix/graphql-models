import isEmpty from "lodash/isEmpty"
import mapKeys from "lodash/mapKeys"
import mapValues from "lodash/mapValues"

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

// extends the given key if already present, set otherwise
const _extendKey = (obj, key, arr) => {
    obj[key] = key in obj ? [...obj[key], ...arr] : arr
}

export const searchWhereRecursive = (searchParams, searchFunc) => {
    if (!searchParams) {
        return {}
    }

    const ret = searchFunc(searchParams)

    // handle special mongodb operators
    if ("_or" in searchParams) {
        _extendKey(
            ret,
            "$or",
            searchParams["_or"].map((v) => searchWhereRecursive(v, searchFunc))
        )
    }

    if ("_and" in searchParams) {
        _extendKey(
            ret,
            "$and",
            searchParams["_and"].map((v) => searchWhereRecursive(v, searchFunc))
        )
    }

    // $not is not a mongodb top level operator, need to wrap with $and
    if ("_not" in searchParams) {
        _extendKey(
            ret,
            "$and",
            searchParams["_not"].map((v) => {
                const notValue = searchWhereRecursive(v, searchFunc)
                // wrap with $not
                return mapValues(notValue, (v) => ({
                    $not: v,
                }))
            })
        )
    }

    return ret
}
