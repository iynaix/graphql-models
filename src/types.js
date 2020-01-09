// types

const field = (type) => ({
    required = true,
    schemaDoc,
    filterType,
    createFilter = true,
    createOrdeBy = true,
    ...other
} = {}) => ({
    type,
    required,
    schemaDoc,
    filterType,
    createFilter,
    createOrdeBy,
    ...other,
})

export const types = {
    Int: field("Int"),
    Float: field("Float"),
    String: field("String"),
    Boolean: field("Boolean"),
    Enum: (elementType, enumValues = [], other) => {
        if (!enumValues.length) {
            throw Error(`enum values must be provided for ${elementType}`)
        }
        return field(elementType)({ enumValues, ...other })
    },
    List: (elementType, other) => field(`[${elementType}]`)(other),
}

// filters

export const filters = {
    IntFilter: "IntFilter",
    IDFilter: "IDFilter",
    EnumFilter: "EnumFilter",
    FloatFilter: "FloatFilter",
    StringFilter: "StringFilter",
    BooleanFilter: "BooleanFilter",
}
