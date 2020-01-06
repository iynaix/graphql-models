import get from "lodash/get"
import isEmpty from "lodash/isEmpty"

import { types, filters } from "./types"
import { searchBoolean, searchNumeric, searchString, searchWhereRecursive } from "./search"

// generates graphql schema boilerplate for enum
export const enumType = (name, values) => `enum ${name} {
    ${values.join("\n")}
}`

const enumFilterType = (name, type) => `input ${name} {
    _eq: ${type}
    _ne: ${type}
    _in: [${type}!]
    _nin: [${type}!]
}`

// generates graphql schema boilerplate for recursive query
export const whereInput = (name) => `_and: [${name}]\n_not: [${name}]\n_or: [${name}]`

const validateFields = (fieldDefinitions) => {
    Object.entries(fieldDefinitions).forEach(([fieldName, { type }]) => {
        if (!type) {
            throw `${fieldName} has no type specified.`
        }
    })
}

export const createModelSDL = (modelName, fieldDefinitions) => {
    const modelFields = Object.entries(fieldDefinitions).map(
        ([fieldName, { type, required = false, schemaDoc }]) => {
            schemaDoc = `${schemaDoc ? `# ${schemaDoc}\n` : ""}`
            return `${schemaDoc}${fieldName}: ${type}${required ? "!" : ""}`
        }
    )

    return `type ${modelName} {
        ${modelFields.join("\n")}
    }`
}

const createWhereSDL = (queryName, fieldDefinitions) => {
    const enums = []
    const queryWhere = []

    Object.entries(fieldDefinitions).forEach(
        ([fieldName, { type, schemaDoc, createFilter = true, filterType }]) => {
            if (createFilter) {
                schemaDoc = `${schemaDoc ? `# ${schemaDoc}\n` : ""}`

                let finalFilterType = filterType ? filterType : `${type}Filter`
                // special case enums, need to create the enum filter definition
                if (finalFilterType === filters.EnumFilter) {
                    finalFilterType = `${type}EnumFilter`
                    enums.push(enumFilterType(finalFilterType, type))
                }

                queryWhere.push(`${schemaDoc}${fieldName}: ${finalFilterType}`)
            }
        }
    )

    const whereInputName = `${queryName}Where`
    return `${enums.join("\n")}\n\ninput ${whereInputName} {
        ${whereInput(whereInputName)}
        ${queryWhere.join("\n")}
    }`
}

const createOrderBySDL = (queryName, fieldDefinitions) => {
    const queryOrderBy = []
    Object.entries(fieldDefinitions).forEach(([fieldName, { schemaDoc, createOrderBy = true }]) => {
        if (createOrderBy) {
            schemaDoc = `${schemaDoc ? `# ${schemaDoc}\n` : ""}`
            queryOrderBy.push(`${schemaDoc}${fieldName}: OrderBy`)
        }
    })

    const orderByInputName = `${queryName}OrderBy`
    return `input ${orderByInputName} {
        ${queryOrderBy.join("\n")}
    }`
}

const createQuerySDL = (modelName, queryName, queryParameters) => {
    const orderByInputName = `${queryName}OrderBy`
    const whereInputName = `${queryName}Where`

    let extraParams = ""
    if (queryParameters) {
        extraParams = Object.entries(queryParameters)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")
    }

    return `extend type Query {
        ${queryName}(
            ${extraParams}
            orderBy: [${orderByInputName}!]
            where: ${whereInputName}
        ): [${modelName}]!,
    }`
}

// returns a function that creates the mongodb parameters for filtering
const createMongoFilter = (fieldDefinitions = {}) => (whereParams) => {
    const searchResults = []

    Object.entries(fieldDefinitions).forEach(
        ([fieldName, { type, createFilter = true, filterType }]) => {
            if (createFilter) {
                if (!filterType) {
                    filterType = `${type}Filter`
                }

                if (filterType === filters.IDFilter) {
                    if (type === types.Int) {
                        searchResults.push(searchNumeric(whereParams, fieldName))
                    } else if (type === types.String) {
                        searchResults.push(searchString(whereParams, fieldName))
                    }
                } else if (filterType === filters.IntFilter || filterType === filters.FloatFilter) {
                    searchResults.push(searchNumeric(whereParams, fieldName))
                } else if (filterType === filters.BooleanFilter) {
                    searchResults.push(searchBoolean(whereParams, fieldName))
                } else if (
                    filterType === filters.StringFilter ||
                    filterType === filters.EnumFilter
                ) {
                    searchResults.push(searchString(whereParams, fieldName))
                } else {
                    console.error("UNHANDLED FILTER: ", { type, filterType })
                }
            }
        }
    )

    return Object.assign({}, ...searchResults)
}

// creates the mongodb parameters for sorting
const createMongoSort = (orderByParams = [], fieldDefinitions = {}) => {
    const ret = {}

    // merge all the searchParams into a single object
    const mergedOrderBy = Object.assign({}, ...orderByParams)
    Object.entries(mergedOrderBy).forEach(([fieldName, order]) => {
        if (get(fieldDefinitions, `${fieldName}.createOrderBy`, true)) {
            ret[fieldName] = order === "asc" ? 1 : -1
        }
    })

    return ret
}

/*
produces SDL for a model, including both the model and the query
a field has shape: {
    type,
    required = false,
    schemaDoc,
    filterType,
    , // mongodb field name, if different from model field name
    createFilter = true,
    createOrderBy = true,
}
*/
export const createModel = (
    modelName,
    queryName,
    fieldDefinitions,
    // global options
    { queryParameters } = {}
) => {
    validateFields(fieldDefinitions)

    const modelSDL = createModelSDL(modelName, fieldDefinitions)
    const whereSDL = createWhereSDL(queryName, fieldDefinitions)
    const orderBySDL = createOrderBySDL(queryName, fieldDefinitions)
    const querySDL = createQuerySDL(modelName, queryName, queryParameters)

    return `${modelSDL}\n${whereSDL}\n${orderBySDL}\n${querySDL}`
}

// creates the search parameters to be passed into mongo's aggregate()
export const createMongoResolver = (searchParams, fieldDefinitions, defaultSort = {}) => {
    const mongoSort = createMongoSort(searchParams["orderBy"], fieldDefinitions)

    return [
        searchWhereRecursive(searchParams["where"], createMongoFilter(fieldDefinitions)),
        isEmpty(mongoSort) ? defaultSort : mongoSort,
    ]
}
