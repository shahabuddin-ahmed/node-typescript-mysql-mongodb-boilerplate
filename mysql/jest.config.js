module.exports = {
    moduleFileExtensions: ["ts", "js"],
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
    },
    testMatch: ["**/src/**/*.test.(ts|js)"],
    testEnvironment: "node",
    verbose: true,
};
