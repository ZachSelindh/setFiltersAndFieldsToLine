const lodash = require('lodash');

const filterRecursively = (filterPayload, line) => {
    const processObject = (filterObject, propLine) => {
        let returnObject = {};

        Object.keys(filterObject).forEach(payloadItem => {
            if ('field' === payloadItem) {
                if (!filterObject.field.includes(`${propLine}-`)) {
                    return (returnObject = filterObject);
                }
            }
            if ('logic' === payloadItem) {
                return (returnObject[payloadItem] = filterObject[payloadItem]);
            }
            if ('conditions' === payloadItem) {
                const processedConditions = filterRecursively(filterObject[payloadItem], propLine);
                return (returnObject[payloadItem] = processedConditions);
            }
        });

        if (0 < Object.keys(returnObject).length) {
            return returnObject;
        }
    };

    if (Array.isArray(filterPayload)) {
        const returnArray = [];
        filterPayload.forEach(filterItem => {
            const newFilter = filterRecursively(filterItem, line);
            if (newFilter) {
                returnArray.push(newFilter);
            }
        });
        return returnArray;
    }
    if ('object' === typeof filterPayload) {
        return processObject(filterPayload, line);
    }
};

const setFiltersAndFieldsToLine = (query, line, shouldJoin = false) => {
    const newQuery = query;

    const filterConditions = query.filters && JSON.parse(query.filters);
    const headerFilters = filterConditions && filterRecursively(filterConditions, line);

    if (filterConditions && headerFilters) {
        if (headerFilters.conditions && headerFilters.conditions.length) {
            newQuery.filters = JSON.stringify(headerFilters);
        } else if (!headerFilters.conditions || 0 === headerFilters.conditions.length) {
            delete newQuery.filters;
        }
    }

    const filterFields = query.fields && JSON.parse(query.fields);
    const headerFields = (filterFields && filterFields.filter(field => !field.includes(`${line}-`))) || [];

    if (filterFields && filterFields.length) {
        newQuery.fields = JSON.stringify(headerFields);
    }

    const previousRelations = query.relations && JSON.parse(query.relations);
    const relationOverlapped = previousRelations && previousRelations.find(item => item.name.includes(`${line}`));

    const relationFields =
        (filterFields && filterFields.filter(field => field.includes(`${line}-`)).map(field => field.split('-')[1])) ||
        [];

    const lineFilters =
        filterConditions &&
        filterConditions.conditions &&
        filterConditions.conditions
            .filter(filter => filter.field && filter.field.includes(`${line}-`))
            .map(cond => ({ ...cond, field: cond.field.split('-')[1] }));

    const newRelations = [];

    if (relationOverlapped && relationOverlapped.name === line) {
        const relObj = {};
        relObj.name = line;

        const newRelationFilters =
            relationOverlapped.filters && relationOverlapped.filters.conditions
                ? [...lineFilters, ...relationOverlapped.filters.conditions]
                : lineFilters;

        const newRelationFields =
            relationOverlapped && relationOverlapped.fields
                ? [...relationFields, ...relationOverlapped.fields]
                : relationFields;

        if (newRelationFilters) {
            relObj.filters = {
                conditions: newRelationFilters,
            };
        }

        if (newRelationFields) {
            relObj.fields = newRelationFields;
        }

        newRelations.push(relObj);
    } else if ((lineFilters && lineFilters.length) || (relationFields && relationFields.length) || shouldJoin) {
        const relObj = {};
        relObj.name = line;
        if (lineFilters) {
            relObj.filters = { conditions: lineFilters };
        }
        if (relationFields && relationFields.length) {
            relObj.fields = relationFields;
        }
        newRelations.push(relObj);
    }

    let conditionalRelations = [];
    if (newRelations && !previousRelations) {
        conditionalRelations = newRelations;
    } else if (!newRelations && previousRelations) {
        conditionalRelations = previousRelations;
    } else if (newRelations && previousRelations && !relationOverlapped) {
        conditionalRelations = [...previousRelations, ...newRelations];
    } else if (newRelations && previousRelations && relationOverlapped) {
        conditionalRelations = lodash.merge(previousRelations, newRelations);
    }

    if (conditionalRelations && conditionalRelations.length) {
        newQuery.relations = JSON.stringify(conditionalRelations);
    }

    const sortQuery = query.sort && JSON.parse(query.sort);
    const headerSorts =
        sortQuery && sortQuery.filter(sort => !(sort.field.includes(`${line}-`) || sort.field.includes(`${line}s-`)));
    const relationSorts =
        sortQuery && sortQuery.filter(sort => sort.field.includes(`${line}-`) || sort.field.includes(`${line}s-`));
    const processedRelationSorts =
        relationSorts && relationSorts.map(item => ({ ...item, field: item.field.replace('-', '.') }));

    let newSorts = [];
    if (headerSorts && !processedRelationSorts) {
        newSorts = [...headerSorts];
    } else if (!headerSorts && processedRelationSorts) {
        newSorts = [...processedRelationSorts];
    } else if (headerSorts && processedRelationSorts) {
        newSorts = [...headerSorts, ...processedRelationSorts];
    }

    if (newSorts && newSorts.length) {
        newQuery.sort = JSON.stringify(newSorts);
    }

    if (shouldJoin) {
        newQuery.join = shouldJoin;
    }

    if (query.allPages) {
        newQuery.allPages = query.allPages;
    }

    if (query.range) {
        newQuery.range = query.range;
    }

    return newQuery;
};

module.exports = { setFiltersAndFieldsToLine };
