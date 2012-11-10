var semver = require("./semver");

var isValidVersion = exports.isValidVersion = function(version) {
    try {
        semver.parseVersion(version);
    } catch (e) {
        return false;
    }
    return true;
};

var isValidRange = exports.isValidRange = function(range) {
    try {
        semver.parseRange(range);
    } catch (e) {
        return false;
    }
    return true;
};

var verify = exports.verify = function(desc) {
    try {
        // required fields
        verifyName(desc.name);
        verifyVersion(desc.version);
        verifyDescription(desc.description);
        verifyKeywords(desc.keywords);
        verifyRepositories(desc.repositories);
        verifyLicenses(desc.licenses);
        verifyAuthor(desc);
        if (desc.author != null) {
            verifyAuthorData(desc.author);
        }
        if (desc.maintainers != null) {
            verifyAuthors(desc.maintainers);
        }
        if (desc.contributors != null) {
            verifyAuthors(desc.contributors);
        }
        // optional fields
        if (desc.engines != null) {
            verifyEngines(desc.engines);
        }
        if (desc.dependencies != null) {
            verifyDependencies(desc.dependencies);
        }
    } catch (e) {
        throw new Error("Invalid package.json: " + e.message,
                e.fileName, e.lineNumber);
    }
};

var sanitize = exports.sanitize = function(desc) {
    desc.name = desc.name.trim();
    desc.version = semver.cleanVersion(desc.version);
    desc.description = desc.description.trim();
    sanitizeKeywords(desc.keywords);
    sanitizeRepositories(desc.repositories);
    sanitizeLicenses(desc.licenses);
    if (desc.author != null) {
        sanitizeAuthor(desc.author);
    }
    if (desc.engines != null) {
        sanitizeDependencies(desc.engines);
    }
    if (desc.dependencies != null) {
        sanitizeDependencies(desc.dependencies);
    }
    return;
};

var verifyName = exports.verifyName = function(name) {
    if (typeof(name) !== "string" || name.length < 1) {
        throw new Error("Invalid or missing package name");
    }
    if (/[^a-z0-9._\- ]/.test(name)) {
        throw new Error("The package name may only contain lowercase \
                alphanumeric characters and '.', '_' or '-'");
    }
    return true;
};

var verifyVersion = exports.verifyVersion = function(version) {
    if (typeof(version) !== "string" || version.length < 1 || !isValidVersion(version)) {
        throw new Error("Invalid or missing package version");
    }
    return true;
};

var verifyDescription = exports.verifyDescription = function(description) {
    if (typeof(description) !== "string" || description.length < 1) {
        throw new Error("Missing or invalid package descriptor field 'description'");
    }
    return true;
};

var hasEngineDependency = exports.hasEngineDependency = function(desc) {
    if (!desc.engines || desc.engines.constructor !== Object) {
        return false;
    }
    return desc.engines.hasOwnProperty("ringojs") &&
            isValidRange(desc.engines.ringojs);
};

var verifyEngineDependency = exports.verifyEngineDependency = function(desc, engineVersion) {
    if (!semver.satisfies(engineVersion, desc.engines.ringojs)) {
        throw new Error(desc.name + " requires RingoJS " +
                desc.engines.ringojs + ", yours is " + engineVersion);
    }
    return true;
};

var verifyKeywords = exports.verifyKeywords = function(keywords) {
    if (keywords === null || keywords === undefined) {
        throw new Error("Missing package keywords");
    } else if (keywords.constructor !== Array) {
        throw new Error("Invalid package keywords");
    } else if (keywords.length < 1) {
        throw new Error("Package needs at least one keyword specified");
    }
    return true;
};

var verifyEngines = exports.verifyEngines = function(engines) {
    if (engines.constructor !== Object) {
        throw new Error("Invalid 'engines' specification. Please use an object \
                with at least a property 'ringojs' containing the minimum RingoJS \
                version this package requires.");
    }
    return verifyDependencies(engines);
};

var verifyDependencies = exports.verifyDependencies = function(deps) {
    for each (var key in Object.keys(deps)) {
        if (!isValidRange(deps[key])) {
            throw new Error("Dependency spec '" + key +
                    "' contains an invalid version number: " + deps[key]);
        }
    }
    return true;
};

var sanitizeDependencies = exports.sanitizeDependencies = function(deps) {
    for each (var key in Object.keys(deps)) {
        deps[key] = semver.parseRange(deps[key]).join(" ").trim();
    }
};

var sanitizeKeywords = exports.sanitizeKeywords = function(keywords) {
    keywords.forEach(function(keyword, idx) {
        keywords[idx] = keyword.trim();
    });
};

var verifyAuthorData = exports.verifyAuthorData = function(author) {
    if (typeof(author) !== "string" && author.constructor !== Object) {
        throw new Error("Invalid author definition");
    }
    if (author.constructor === Object) {
        if (typeof(author.name) !== "string" || author.name.length < 1) {
            throw new Error("Missing author name");
        }
    }
    return true;
};

var verifyAuthor = exports.verifyAuthor = function(desc) {
    if (!desc.author &&
            (!(desc.contributors instanceof Array) ||
                    desc.contributors.length < 1)) {
        throw new Error("Missing author or initial contributor");
    }
    return true;
};

var verifyAuthors = exports.verifyAuthors = function(arr) {
    if (arr.constructor !== Array) {
        throw new Error("Invalid contributors/maintainers definition (must be Array)");
    }
    return arr.every(verifyAuthorData);
};

var sanitizeAuthor = exports.sanitizeAuthor = function(author) {
    for each (var prop in ["name", "email", "web"]) {
        if (author[prop]) {
            author[prop] = author[prop].trim();
        }
    }
};

var verifyHashList = exports.verifyHashList = function(arr, name, requiredProps) {
    if (arr === null || arr === undefined) {
        throw new Error("Missing " + name + " list");
    } else if (arr.constructor !== Array) {
        throw new Error("Invalid " + name + " definition (must be Array)");
    } else if (arr.length < 1) {
        throw new Error("Empty " + name + " list");
    }
    arr.forEach(function(obj) {
        requiredProps.forEach(function(prop) {
            if (typeof(obj[prop]) !== "string" || obj[prop].length < 1) {
                throw new Error("Missing " + name + " " + prop + " definition");
            }
        });
    });
    return true;
};

var verifyRepositories = exports.verifyRepositories = function(repositories) {
    return verifyHashList(repositories, "repository", ["type", "url"]);
};

var sanitizeRepositories = exports.sanitizeRepositories = function(repositories) {
    sanitizeHashList(repositories, ["type", "url"]);
};

var verifyLicenses = exports.verifyLicenses = function(licenses) {
    return verifyHashList(licenses, "licenses", ["type", "url"]);
};

var sanitizeLicenses = exports.sanitizeLicenses = function(licenses) {
    sanitizeHashList(licenses, ["type", "url"]);
};

var getAuthor = exports.getAuthor = function(descriptor) {
    var author = descriptor.author ||
            (descriptor.contributors && descriptor.contributors[0]) || null;
    if (author !== null) {
        if (typeof(author) === "string") {
            return parseAuthor(author);
        }
        return author;
    }
    return null;
};

var sanitizeHashList = exports.sanitizeHashList = function(arr, props) {
    arr.forEach(function(source, idx) {
        var dest = arr[idx] = {};
        props.forEach(function(name) {
            var value = source[name];
            if (typeof(value) === "string") {
                value = value.trim();
            }
            dest[name] = value;
        });
    });
};

var parseAuthor = function(str) {
    var result = {};
    var key = "name";
    var idx = 0;
    var buf = [];
    while (idx < str.length) {
        var c = str.charAt(idx);
        switch (c) {
            case "(":
            case "<":
                if (key !== null) {
                    result[key] = buf.join("").trim();
                }
                buf.length = 0;
                key = (c === "<") ? "email" : "web";
                break;
            case ")":
            case ">":
                if (key !== null) {
                    result[key] = buf.join("").trim();
                }
                buf.length = 0;
                key = null;
                break;
            default:
                if (key != null) {
                    buf.push(c);
                }
        }
        idx += 1;
    }
    if (buf.length > 0 && key !== null) {
        result[key] = buf.join("");
    }
    return result;
};
