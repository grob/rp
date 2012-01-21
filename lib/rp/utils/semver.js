export("isGreater", "isGreaterOrEqual", "isLower", "isLowerOrEqual", "satisfies",
         "parseVersion", "parseRange", "sanitizeRange", "cleanVersion", "sort", "getSorter");

var REGEX_VERSION = /^v?([\dx]+)(?:\.([\dx]+))?(?:\.([\dx]+))?(.*)$/i;
var REGEX_RANGE = /^\s*([<>=]*)\s*([\d\.a-z]+)[\s-]*(?:([<>=]+)?\s*([\d\.a-z]+)\s*)?$/i;
var OPERATORS = {
    ">": "isGreater",
    ">=": "isGreaterOrEqual",
    "<": "isLower",
    "<=": "isLowerOrEqual"
};
var COMPARATORS = {
    "isGreater": function(valueA, tagA, valueB, tagB) {
        if (valueA === valueB) {
            return COMPARATORS.tagIsGreater(tagA || "", tagB || "");
        }
        return valueA > valueB;
    },
    "isGreaterOrEqual": function(valueA, tagA, valueB, tagB) {
        if (valueA === valueB) {
            return COMPARATORS.tagIsGreaterOrEqual(tagA || "", tagB || "");
        }
        return valueA >= valueB;
    },
    "isLower": function(valueA, tagA, valueB, tagB) {
        return COMPARATORS.isGreater(valueB, tagB, valueA, tagA);
    },
    "isLowerOrEqual": function(valueA, tagA, valueB, tagB) {
        return COMPARATORS.isGreaterOrEqual(valueB, tagB, valueA, tagA);
    },
    "tagIsGreater": function(tagLeft, tagRight) {
        return !!tagRight && (!tagLeft || tagLeft > tagRight);
    },
    "tagIsGreaterOrEqual": function(tagLeft, tagRight) {
        return (!tagLeft && !tagRight) || COMPARATORS.tagIsGreater(tagLeft, tagRight);
    }
};

var isGreater = function(versionA, versionB) {
    return compare(versionA, versionB, "isGreater");
};

var isGreaterOrEqual = function(versionA, versionB) {
    return compare(versionA, versionB, "isGreaterOrEqual");
};

var isLower = function(versionA, versionB) {
    return compare(versionA, versionB, "isLower");
};

var isLowerOrEqual = function(versionA, versionB) {
    return compare(versionA, versionB, "isLowerOrEqual");
};

var compare = function(versionA, versionB, comparatorName) {
    var [valueA, tagA] = sanitizeVersion(versionA);
    var [valueB, tagB] = sanitizeVersion(versionB);
    return COMPARATORS[comparatorName](valueA, tagA, valueB, tagB);
};

var satisfies = function(version, range) {
    if (typeof(range) !== "string" || range.length < 1) {
        // no range given, so version satisfies constraint
        return true;
    }
    var [versionValue, versionTag] = sanitizeVersion(version);
    return sanitizeRange(range).every(function(part) {
        return toComparator.apply(null, part)(versionValue, versionTag);
    });
};

var toNumber = function(nr) {
    if (typeof(nr) === "string" && nr.length > 0) {
        if (nr === "x" || nr === "X") {
            return nr;
        }
        if (!isNaN(nr)) {
            return parseInt(nr, 10);
        }
        return nr;
    }
    return null;
};

var parseVersion = function(version) {
    var match = version.match(REGEX_VERSION);
    if (match === null) {
        throw new Error("Unable to parse version '" + version + "'");
    }
    return [match[1], match[2], match[3], match[4]].map(toNumber);
};

var parseRange = function(range) {
    var match = range.match(REGEX_RANGE);
    if (match === null) {
        throw new Error("Unable to parse range '" + range + "'");
    }
    return [match[1] || null, match[2], match[3] || null, match[4]];
};

var sanitizeRange = function(range) {
    var [loper, lver, roper, rver] = parseRange(range);
    var left = sanitizeRangeVersion(loper || ">=", lver);
    // return just left part if it has specified an operator and
    // the right range part is missing
    if (loper && lver && !rver) {
        return [left];
    }
    var right = sanitizeRangeVersion(roper || "<=", rver || lver);
    return [left, right];
};

var toComparator = function(operator, rangeValue, rangeTag) {
    return function(value, tag) {
        var comparatorName = OPERATORS[operator];
        return COMPARATORS[comparatorName](value, tag, rangeValue, rangeTag);
    };
};

var isExact = function(M, m, p) {
    return (M != null && M != "x")
        && (m != null && m != "x")
        && (p != null && p != "x");
};

var sanitizeRangeVersion = function(operator, version) {
    var [M, m, p, tag] = parseVersion(version);
    var wildcardValue = 0;
    if (operator === "<=" && !isExact(M, m, p)) {
        operator = "<";
        wildcardValue = 10000;
    }
    var value = getVersionValue(M, m, p, wildcardValue);
    return [operator, value, tag];
};

var getVersionValue = function(M, m, p, wildcardValue) {
    var foundWildcard = false;
    return [M, m, p].reduce(function(prev, curr, idx, arr) {
        if (curr == undefined || curr === "x") {
            if (!foundWildcard) {
                curr = wildcardValue;
                foundWildcard = true;
            } else {
                curr = 0;
            }
        }
        return prev + (curr * Math.pow(10000, arr.length - idx - 1));
    }, 0);
};

var sanitizeVersion = function(version) {
    var [M, m, p, tag] = parseVersion(version);
    var value = getVersionValue(M, m, p, 0);
    return [value, tag];
}

var cleanVersion = function(version) {
    var [M, m, p, tag] = parseVersion(version);
    return [M || 0, ".", m || 0, ".", p || 0, tag || ""].join("");
};

var getSorter = function(order) {
    return function(a, b) {
        var [valueA, tagA] = sanitizeVersion(a);
        var [valueB, tagB] = sanitizeVersion(b);
        if (COMPARATORS.isLower(valueA, tagA, valueB, tagB)) {
            return order * -1;
        } else if (COMPARATORS.isGreater(valueA, tagA, valueB, tagB)) {
            return order;
        }
        return 0;
    }
};

var sort = function(arr, order) {
    return arr.sort(getSorter(order || 1));
};
