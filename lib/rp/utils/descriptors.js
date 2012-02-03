var semver = require("./semver");

export("check", "sanitize", "checkName", "checkVersion", "checkDescription",
        "checkEngines", "checkDependencies", "hasEngineDependency",
        "checkEngineDependency", "checkKeywords",
        "sanitizeKeywords", "checkAuthor", "checkAuthorData", "sanitizeAuthor");

var isValidVersion = function(version) {
    try {
        semver.parseVersion(version);
    } catch (e) {
        return false;
    }
    return true;
};

var isValidRange = function(range) {
    try {
        semver.parseRange(range);
    } catch (e) {
        return false;
    }
    return true;
};

var check = function(desc) {
    // required fields
    checkName(desc.name);
    checkVersion(desc.version);
    checkDescription(desc.description);
    checkKeywords(desc.keywords);
    if (desc.author != null) {
        checkAuthorData(desc.author);
    }
    if (desc.maintainers != null) {
        checkAuthors(desc.maintainers);
    }
    if (desc.contributors != null) {
        checkAuthors(desc.contributors);
    }
    // optional fields
    if (desc.engines != null) {
        checkEngines(desc.engines);
    }
    if (desc.dependencies != null) {
        checkDependencies(desc.dependencies);
    }
};

var sanitize = function(desc) {
    desc.name = desc.name.trim();
    desc.version = semver.cleanVersion(desc.version);
    desc.description = desc.description.trim();
    sanitizeKeywords(desc.keywords);
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

var checkName = function(name) {
    if (typeof(name) !== "string" || name.length < 1) {
        throw new Error("Invalid or missing package name");
    }
    if (/[^a-z0-9._\- ]/.test(name)) {
        throw new Error("The package name may only contain lowercase \
                alphanumeric characters and '.', '_' or '-'");
    }
    return true;
};

var checkVersion = function(version) {
    if (typeof(version) !== "string" || version.length < 1 || !isValidVersion(version)) {
        throw new Error("Invalid or missing package version");
    }
    return true;
};

var checkDescription = function(description) {
    if (typeof(description) !== "string" || description.length < 1) {
        throw new Error("Missing or invalid package descriptor field 'description'");
    }
    return true;
};

var hasEngineDependency = function(desc) {
    if (!desc.engines || desc.engines.constructor !== Object) {
        return false;
    }
    return desc.engines.hasOwnProperty("ringojs") &&
            isValidRange(desc.engines.ringojs);
};

var checkEngineDependency = function(desc, engineVersion) {
    if (!semver.satisfies(engineVersion, desc.engines.ringojs)) {
        throw new Error(desc.name + " requires RingoJS " +
                desc.engines.ringojs + ", yours is " + engineVersion);
    }
    return true;
};

var checkKeywords = function(keywords) {
    if (keywords === null || keywords === undefined) {
        throw new Error("Missing package keywords");
    } else if (keywords.constructor !== Array) {
        throw new Error("Invalid package keywords");
    } else if (keywords.length < 1) {
        throw new Error("Package needs at least one keyword specified");
    }
    return true;
};

var checkEngines = function(engines) {
    if (engines.constructor !== Object) {
        throw new Error("Invalid 'engines' specification. Please use an object \
                with at least a property 'ringojs' containing the minimum RingoJS \
                version this package requires.");
    }
    return checkDependencies(engines);
};

var checkDependencies = function(deps) {
    for each (var key in Object.keys(deps)) {
        if (!isValidRange(deps[key])) {
            throw new Error("Dependency spec '" + key +
                    "' contains an invalid version number: " + deps[key]);
        }
    }
    return true;
};

var sanitizeDependencies = function(deps) {
    for each (var key in Object.keys(deps)) {
        deps[key] = semver.parseRange(deps[key]).join(" ").trim();
    }
};

var sanitizeKeywords = function(keywords) {
    keywords.forEach(function(keyword, idx) {
        keywords[idx] = keyword.trim();
    });
};

var checkAuthorData = function(author) {
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

var checkAuthor = function(desc) {
    if (!desc.author &&
            (!(desc.contributors instanceof Array) ||
                    desc.contributors.length < 1)) {
        throw new Error("Missing author or initial contributor");
    }
    return true;
};

var checkAuthors = function(arr) {
    return arr.every(checkAuthorData);
};

var sanitizeAuthor = function(author) {
    for each (var prop in ["name", "email", "web"]) {
        if (author[prop]) {
            author[prop] = author[prop].trim();
        }
    }
};
