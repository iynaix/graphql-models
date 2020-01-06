// types

export const types = {
    Int: "Int",
    Float: "Float",
    String: "String",
    Boolean: "Boolean",
    List: (elementType) => `[${elementType}]`,
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
